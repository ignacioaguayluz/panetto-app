import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  addIngredient,
  createDraft,
  editIngredient,
  parseDecimal,
  removeIngredient,
  switchMode,
  type EntryMode,
  type RecipeDraft,
} from './src/domain/recipe';
import { openExpoRecipeRepository } from './src/storage/expoRecipeRepository';
import type { SavedRecipe } from './src/storage/recipeRepository';
import {
  draftWithRawValues,
  editorExitAction,
  persistEditorDraft,
  recipeDraftFromSaved,
  syncRawValuesWithDraft,
  updateEditorIngredientValue,
  type EditorExitChoice,
} from './src/ui/recipeEditorModel';

const COLORS = {
  background: '#F7F4EC',
  surface: '#FFFFFF',
  ink: '#1D3028',
  muted: '#6B776F',
  line: '#E5E2D9',
  green: '#2E5946',
  greenSoft: '#E8F0E9',
  orange: '#D97845',
  orangeSoft: '#FFF0E7',
  danger: '#A63B32',
  dangerSoft: '#FCEDEA',
};

function messageFor(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error inesperado. Intentá de nuevo.';
}

function createId(): string {
  return `recipe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function AppContent() {
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [repository, setRepository] = useState<Awaited<ReturnType<typeof openExpoRecipeRepository>> | null>(null);
  const [screen, setScreen] = useState<'list' | 'editor'>('list');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editorError, setEditorError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [rawValues, setRawValues] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [baseModalVisible, setBaseModalVisible] = useState(false);
  const [baseGramsText, setBaseGramsText] = useState('');
  const [baseError, setBaseError] = useState('');

  const loadRecipes = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const nextRepository = await openExpoRecipeRepository();
      const storedRecipes = await nextRepository.list();
      setRepository(nextRepository);
      setRecipes(storedRecipes);
    } catch (error) {
      setLoadError(messageFor(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecipes();
  }, [loadRecipes]);

  const closeEditor = useCallback(() => {
    setScreen('list');
    setEditingId(null);
    setDraft(null);
    setRawValues({});
    setDirty(false);
    setEditorError('');
    setBaseModalVisible(false);
  }, []);

  const persistDraft = useCallback(async () => {
    if (!repository || !draft) {
      setEditorError('El almacenamiento todavía no está disponible.');
      return false;
    }
    setEditorError('');
    try {
      const id = editingId ?? createId();
      const recipe = await persistEditorDraft(repository, id, draft, rawValues);
      const saved = { id, ...recipe };
      setRecipes(current => {
        const exists = current.some(item => item.id === id);
        return exists
          ? current.map(item => item.id === id ? saved : item)
          : [...current, saved];
      });
      closeEditor();
      return true;
    } catch (error) {
      setEditorError(messageFor(error));
      return false;
    }
  }, [closeEditor, draft, editingId, rawValues, repository]);

  const handleExit = useCallback((choice?: EditorExitChoice) => {
    const action = editorExitAction(dirty, choice);
    if (action === 'leave' || action === 'discard') {
      closeEditor();
      return;
    }
    if (action === 'stay') return;
    if (action === 'save') {
      void persistDraft();
      return;
    }

    Alert.alert(
      'Cambios sin guardar',
      '¿Qué querés hacer con los cambios de esta receta?',
      [
        { text: 'Seguir editando', style: 'cancel' },
        { text: 'Descartar cambios', style: 'destructive', onPress: () => closeEditor() },
        { text: 'Guardar', onPress: () => { void persistDraft(); } },
      ],
      { cancelable: true },
    );
  }, [closeEditor, dirty, persistDraft]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen !== 'editor') return false;
      handleExit();
      return true;
    });
    return () => subscription.remove();
  }, [handleExit, screen]);

  const startNewRecipe = () => {
    const nextDraft = createDraft('', 'grams');
    setEditingId(null);
    setDraft(nextDraft);
    setRawValues({});
    setDirty(false);
    setEditorError('');
    setScreen('editor');
  };

  const openRecipe = async (recipe: SavedRecipe) => {
    if (!repository) return;
    setEditorError('');
    try {
      const stored = await repository.get(recipe.id);
      const model = recipeDraftFromSaved(stored);
      setEditingId(stored.id);
      setDraft(model.draft);
      setRawValues({ ...model.rawValues });
      setDirty(false);
      setScreen('editor');
    } catch (error) {
      Alert.alert('No se pudo abrir la receta', messageFor(error));
    }
  };

  const confirmDelete = (recipe: SavedRecipe) => {
    Alert.alert(
      'Eliminar receta',
      `Se eliminará “${recipe.name}”. Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              if (!repository) return;
              try {
                await repository.delete(recipe.id);
                setRecipes(current => current.filter(item => item.id !== recipe.id));
              } catch (error) {
                Alert.alert('No se pudo eliminar', messageFor(error));
              }
            })();
          },
        },
      ],
      { cancelable: true },
    );
  };

  const updateName = (name: string) => {
    setDraft(current => current ? { ...current, name } : current);
    setDirty(true);
    setEditorError('');
  };

  const updateIngredientName = (id: string, name: string) => {
    setDraft(current => current ? {
      ...current,
      ingredients: current.ingredients.map(item => item.id === id ? { ...item, name } : item),
    } : current);
    setDirty(true);
    setEditorError('');
  };

  const updateIngredientValue = (id: string, text: string) => {
    if (!draft) return;
    const result = updateEditorIngredientValue(draft, id, text, rawValues);
    setDraft(result.draft);
    setRawValues({ ...result.rawValues });
    setDirty(true);
    setEditorError(result.error ?? '');
  };

  const toggleFlour = (id: string, isFlour: boolean) => {
    if (!draft) return;
    try {
      const updated = editIngredient(draft, id, { isFlour });
      setDraft(updated);
      setRawValues(syncRawValuesWithDraft(updated, rawValues));
      setDirty(true);
      setEditorError('');
    } catch (error) {
      setEditorError(messageFor(error));
    }
  };

  const addNewIngredient = () => {
    if (!draft) return;
    const id = createId();
    try {
      const updated = addIngredient(draft, { id, name: '', value: 0, isFlour: false });
      setDraft(updated);
      setRawValues(syncRawValuesWithDraft(updated, rawValues));
      setDirty(true);
      setEditorError('');
    } catch (error) {
      setEditorError(messageFor(error));
    }
  };

  const removeDraftIngredient = (id: string) => {
    if (!draft) return;
    try {
      const updated = removeIngredient(draft, id);
      setDraft(updated);
      setRawValues(syncRawValuesWithDraft(updated, rawValues));
      setDirty(true);
      setEditorError('');
    } catch (error) {
      setEditorError(messageFor(error));
    }
  };

  const chooseMode = (mode: EntryMode) => {
    if (!draft || mode === draft.mode) return;
    if (mode === 'grams' && !draft.baseGrams) {
      setBaseGramsText('');
      setBaseError('');
      setBaseModalVisible(true);
      return;
    }
    try {
      const updated = switchMode(draftWithRawValues(draft, rawValues), mode);
      setDraft(updated);
      setRawValues(syncRawValuesWithDraft(updated, rawValues));
      setDirty(true);
      setEditorError('');
    } catch (error) {
      setEditorError(messageFor(error));
    }
  };

  const confirmBaseGrams = () => {
    if (!draft) return;
    try {
      const baseGrams = parseDecimal(baseGramsText);
      const updated = switchMode(draftWithRawValues(draft, rawValues), 'grams', baseGrams);
      setDraft(updated);
      setRawValues(syncRawValuesWithDraft(updated, rawValues));
      setDirty(true);
      setEditorError('');
      setBaseModalVisible(false);
    } catch (error) {
      setBaseError(messageFor(error));
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <View style={styles.centerState}>
          <Text style={styles.eyebrow}>PANETTO</Text>
          <Text style={styles.stateText}>Abriendo tus recetas…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <View style={styles.centerState}>
          <View style={styles.errorIcon}><Text style={styles.errorIconText}>!</Text></View>
          <Text style={styles.stateTitle}>No pudimos abrir el recetario</Text>
          <Text style={styles.errorText}>{loadError}</Text>
          <PrimaryButton label="Reintentar" onPress={() => void loadRecipes()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {screen === 'list' ? (
          <RecipeLibrary
            recipes={recipes}
            onCreate={startNewRecipe}
            onOpen={recipe => void openRecipe(recipe)}
            onDelete={confirmDelete}
          />
        ) : draft ? (
          <RecipeEditor
            draft={draft}
            rawValues={rawValues}
            editing={editingId !== null}
            dirty={dirty}
            error={editorError}
            onBack={() => handleExit()}
            onSave={() => void persistDraft()}
            onChangeName={updateName}
            onChangeIngredientName={updateIngredientName}
            onChangeIngredientValue={updateIngredientValue}
            onToggleFlour={toggleFlour}
            onAddIngredient={addNewIngredient}
            onRemoveIngredient={removeDraftIngredient}
            onChooseMode={chooseMode}
          />
        ) : null}
      </KeyboardAvoidingView>
      <Modal
        visible={baseModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBaseModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEyebrow}>CAMBIO DE MODO</Text>
            <Text style={styles.modalTitle}>¿Cuánta harina vas a usar?</Text>
            <Text style={styles.modalBody}>Necesitamos la harina total para mostrar esta receta en gramos. La fórmula no se modifica.</Text>
            <TextInput
              accessibilityLabel="Harina total base en gramos"
              autoFocus
              keyboardType="decimal-pad"
              value={baseGramsText}
              onChangeText={text => { setBaseGramsText(text); setBaseError(''); }}
              placeholder="Ej.: 500"
              placeholderTextColor={COLORS.muted}
              style={styles.baseInput}
            />
            {baseError ? <Text accessibilityRole="alert" style={styles.errorText}>{baseError}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable accessibilityRole="button" onPress={() => setBaseModalVisible(false)} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </Pressable>
              <PrimaryButton label="Continuar" onPress={confirmBaseGrams} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function RecipeLibrary({
  recipes,
  onCreate,
  onOpen,
  onDelete,
}: {
  recipes: SavedRecipe[];
  onCreate: () => void;
  onOpen: (recipe: SavedRecipe) => void;
  onDelete: (recipe: SavedRecipe) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.libraryContent} keyboardShouldPersistTaps="handled">
      <View style={styles.brandHeader}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>P</Text></View>
        <View>
          <Text style={styles.brandName}>panetto</Text>
          <Text style={styles.brandCaption}>RECETARIO DE PANADERÍA</Text>
        </View>
      </View>

      <View style={styles.libraryIntro}>
        <Text style={styles.eyebrow}>TU ESPACIO DE TRABAJO</Text>
        <Text style={styles.pageTitle}>Tus recetas</Text>
        <Text style={styles.pageSubtitle}>Fórmulas listas para acompañar tu producción.</Text>
      </View>

      <PrimaryButton label="＋  Nueva receta" onPress={onCreate} />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recetario</Text>
        <Text style={styles.countPill}>{recipes.length}</Text>
      </View>

      {recipes.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIllustration}><Text style={styles.emptyIllustrationText}>P</Text></View>
          <Text style={styles.emptyTitle}>Tu recetario empieza acá</Text>
          <Text style={styles.emptyBody}>Guardá tus fórmulas de trabajo y encontralas cuando las necesites.</Text>
          <Pressable accessibilityRole="button" onPress={onCreate} style={styles.textButton}>
            <Text style={styles.textButtonLabel}>Crear mi primera receta</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.recipeList}>
          {recipes.map(recipe => {
            const flourCount = recipe.ingredients.filter(item => item.isFlour).length;
            return (
              <View key={recipe.id} style={styles.recipeCard}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir receta ${recipe.name}`}
                  onPress={() => onOpen(recipe)}
                  style={({ pressed }) => [styles.recipeMain, pressed && styles.pressed]}
                >
                  <View style={styles.recipeGlyph}><Text style={styles.recipeGlyphText}>R</Text></View>
                  <View style={styles.recipeDetails}>
                    <Text style={styles.recipeName} numberOfLines={2}>{recipe.name}</Text>
                    <Text style={styles.recipeMeta}>
                      {recipe.ingredients.length} {recipe.ingredients.length === 1 ? 'ingrediente' : 'ingredientes'} · {flourCount} {flourCount === 1 ? 'harina' : 'harinas'}
                    </Text>
                  </View>
                  <Text accessibilityElementsHidden style={styles.chevron}>›</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Eliminar receta ${recipe.name}`}
                  onPress={() => onDelete(recipe)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
                >
                  <Text style={styles.deleteGlyph}>×</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      <Text style={styles.localNote}>Tus recetas se guardan en este dispositivo y están disponibles sin conexión.</Text>
    </ScrollView>
  );
}

function RecipeEditor({
  draft,
  rawValues,
  editing,
  dirty,
  error,
  onBack,
  onSave,
  onChangeName,
  onChangeIngredientName,
  onChangeIngredientValue,
  onToggleFlour,
  onAddIngredient,
  onRemoveIngredient,
  onChooseMode,
}: {
  draft: RecipeDraft;
  rawValues: Readonly<Record<string, string>>;
  editing: boolean;
  dirty: boolean;
  error: string;
  onBack: () => void;
  onSave: () => void;
  onChangeName: (name: string) => void;
  onChangeIngredientName: (id: string, name: string) => void;
  onChangeIngredientValue: (id: string, value: string) => void;
  onToggleFlour: (id: string, value: boolean) => void;
  onAddIngredient: () => void;
  onRemoveIngredient: (id: string) => void;
  onChooseMode: (mode: EntryMode) => void;
}) {
  return (
    <View style={styles.flex}>
      <View style={styles.editorTopBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver al recetario" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backLabel}>Recetas</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onSave} style={({ pressed }) => [styles.saveTopButton, pressed && styles.pressed]}>
          <Text style={styles.saveTopText}>Guardar</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.editorContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>{editing ? 'EDITAR FÓRMULA' : 'NUEVA FÓRMULA'}</Text>
        <Text style={styles.editorTitle}>{editing ? 'Tu receta' : 'Crear receta'}</Text>
        <Text style={styles.editorSubtitle}>Definí los ingredientes y cómo querés ingresar sus cantidades.</Text>

        <View style={styles.fieldCard}>
          <Text style={styles.fieldLabel}>NOMBRE DE LA RECETA</Text>
          <TextInput
            accessibilityLabel="Nombre de la receta"
            value={draft.name}
            onChangeText={onChangeName}
            placeholder="Ej.: Pan de campo"
            placeholderTextColor={COLORS.muted}
            returnKeyType="done"
            style={styles.recipeNameInput}
          />
        </View>

        <View style={styles.modeHeading}>
          <Text style={styles.sectionTitle}>Modo de ingreso</Text>
          <Text style={styles.helperText}>Podés cambiarlo después</Text>
        </View>
        <View accessibilityRole="radiogroup" style={styles.modeControl}>
          <ModeButton label="Gramos" selected={draft.mode === 'grams'} onPress={() => onChooseMode('grams')} />
          <ModeButton label="Porcentaje" selected={draft.mode === 'percent'} onPress={() => onChooseMode('percent')} />
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Ingredientes</Text>
            <Text style={styles.helperText}>Marcá manualmente cuáles son harina.</Text>
          </View>
          <Text style={styles.countPill}>{draft.ingredients.length}</Text>
        </View>

        {draft.ingredients.length === 0 ? (
          <View style={styles.noIngredients}>
            <Text style={styles.noIngredientsText}>Agregá los ingredientes de esta fórmula.</Text>
          </View>
        ) : (
          <View style={styles.ingredientList}>
            {draft.ingredients.map((ingredient, index) => (
              <View key={ingredient.id} style={styles.ingredientCard}>
                <View style={styles.ingredientHeading}>
                  <Text style={styles.ingredientIndex}>{String(index + 1).padStart(2, '0')}</Text>
                  <Text style={styles.ingredientHeadingLabel}>INGREDIENTE</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Quitar ${ingredient.name || `ingrediente ${index + 1}`}`}
                    onPress={() => onRemoveIngredient(ingredient.id)}
                    hitSlop={8}
                    style={styles.removeIngredientButton}
                  >
                    <Text style={styles.removeIngredientText}>Quitar</Text>
                  </Pressable>
                </View>
                <TextInput
                  accessibilityLabel={`Nombre del ingrediente ${index + 1}`}
                  value={ingredient.name}
                  onChangeText={text => onChangeIngredientName(ingredient.id, text)}
                  placeholder="Ej.: Harina de trigo"
                  placeholderTextColor={COLORS.muted}
                  returnKeyType="done"
                  style={styles.ingredientNameInput}
                />
                <View style={styles.ingredientBottomRow}>
                  <View style={styles.quantityField}>
                    <Text style={styles.fieldLabel}>{draft.mode === 'grams' ? 'CANTIDAD' : 'PORCENTAJE'}</Text>
                    <View style={styles.quantityInputWrap}>
                      <TextInput
                        accessibilityLabel={`${draft.mode === 'grams' ? 'Gramos' : 'Porcentaje'} de ${ingredient.name || `ingrediente ${index + 1}`}`}
                        keyboardType="decimal-pad"
                        value={rawValues[ingredient.id] ?? String(ingredient.value)}
                        onChangeText={text => onChangeIngredientValue(ingredient.id, text)}
                        placeholder="0"
                        placeholderTextColor={COLORS.muted}
                        style={styles.quantityInput}
                      />
                      <Text style={styles.unitLabel}>{draft.mode === 'grams' ? 'g' : '%'}</Text>
                    </View>
                  </View>
                  <View style={styles.flourControl}>
                    <View style={styles.flourCopy}>
                      <Text style={styles.flourLabel}>Es harina</Text>
                      <Text style={styles.flourHint}>Cuenta para el 100 %</Text>
                    </View>
                    <Switch
                      accessibilityLabel={`${ingredient.name || `Ingrediente ${index + 1}`} es harina`}
                      value={ingredient.isFlour}
                      onValueChange={value => onToggleFlour(ingredient.id, value)}
                      trackColor={{ false: '#D5D8D2', true: '#8BA995' }}
                      thumbColor={ingredient.isFlour ? COLORS.green : '#F8F8F5'}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        <Pressable accessibilityRole="button" onPress={onAddIngredient} style={({ pressed }) => [styles.addIngredientButton, pressed && styles.pressed]}>
          <Text style={styles.addPlus}>＋</Text>
          <Text style={styles.addIngredientLabel}>Agregar ingrediente</Text>
        </Pressable>

        <View style={styles.flourNote}>
          <Text style={styles.flourNoteMark}>i</Text>
          <Text style={styles.flourNoteText}>La suma de las harinas debe ser 100 %. El resto de los ingredientes se calcula respecto de esa base.</Text>
        </View>
        {error ? <Text accessibilityRole="alert" style={styles.errorBanner}>{error}</Text> : null}
        <Text style={styles.draftNote}>
          {dirty ? 'Los cambios todavía no están guardados.' : 'Guardá la receta para conservar los cambios.'}
        </Text>
      </ScrollView>
    </View>
  );
}

function ModeButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.modeButton, selected && styles.modeButtonSelected, pressed && styles.pressed]}
    >
      <Text style={[styles.modeButtonLabel, selected && styles.modeButtonLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed]}>
      <Text style={styles.primaryButtonLabel}>{label}</Text>
    </Pressable>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  eyebrow: { color: COLORS.orange, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  stateText: { color: COLORS.muted, fontSize: 16 },
  stateTitle: { color: COLORS.ink, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  errorIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  errorIconText: { color: COLORS.danger, fontSize: 24, fontWeight: '800' },
  errorText: { color: COLORS.danger, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  libraryContent: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 40 },
  brandHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 36 },
  brandMark: { width: 40, height: 40, borderRadius: 14, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: COLORS.surface, fontSize: 23, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
  brandName: { color: COLORS.ink, fontSize: 20, fontWeight: '800', letterSpacing: -0.8 },
  brandCaption: { color: COLORS.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1.1, marginTop: 1 },
  libraryIntro: { marginBottom: 24 },
  pageTitle: { color: COLORS.ink, fontSize: 35, fontWeight: '800', letterSpacing: -1.1, marginTop: 7 },
  pageSubtitle: { color: COLORS.muted, fontSize: 15, lineHeight: 22, marginTop: 5 },
  primaryButton: { minHeight: 52, backgroundColor: COLORS.green, borderRadius: 16, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  primaryPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  primaryButtonLabel: { color: COLORS.surface, fontSize: 16, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 30, marginBottom: 12 },
  sectionTitle: { color: COLORS.ink, fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  countPill: { minWidth: 28, paddingHorizontal: 9, height: 26, borderRadius: 13, backgroundColor: COLORS.greenSoft, color: COLORS.green, textAlign: 'center', textAlignVertical: 'center', fontSize: 13, fontWeight: '800', overflow: 'hidden' },
  emptyCard: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 28, backgroundColor: COLORS.surface, borderRadius: 22, borderWidth: 1, borderColor: COLORS.line },
  emptyIllustration: { width: 58, height: 58, borderRadius: 20, backgroundColor: COLORS.orangeSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyIllustrationText: { color: COLORS.orange, fontSize: 31, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
  emptyTitle: { color: COLORS.ink, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptyBody: { color: COLORS.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 7 },
  textButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, marginTop: 9 },
  textButtonLabel: { color: COLORS.green, fontSize: 15, fontWeight: '800' },
  recipeList: { gap: 11 },
  recipeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, borderRadius: 18, paddingLeft: 12, paddingRight: 8, minHeight: 82 },
  recipeMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 74 },
  recipeGlyph: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.greenSoft, alignItems: 'center', justifyContent: 'center' },
  recipeGlyphText: { color: COLORS.green, fontSize: 17, fontWeight: '900' },
  recipeDetails: { flex: 1, gap: 4 },
  recipeName: { color: COLORS.ink, fontSize: 16, fontWeight: '800' },
  recipeMeta: { color: COLORS.muted, fontSize: 12 },
  chevron: { color: COLORS.muted, fontSize: 27, paddingHorizontal: 7 },
  deleteButton: { width: 42, height: 44, borderRadius: 13, backgroundColor: COLORS.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  deleteGlyph: { color: COLORS.danger, fontSize: 23, fontWeight: '500', lineHeight: 25 },
  pressed: { opacity: 0.7 },
  localNote: { color: COLORS.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 24, paddingHorizontal: 16 },
  editorTopBar: { minHeight: 54, paddingHorizontal: 19, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.line },
  backButton: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingRight: 10 },
  backArrow: { color: COLORS.green, fontSize: 32, lineHeight: 35, marginRight: 4 },
  backLabel: { color: COLORS.green, fontSize: 15, fontWeight: '700' },
  saveTopButton: { minHeight: 42, minWidth: 82, borderRadius: 13, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13 },
  saveTopText: { color: COLORS.surface, fontSize: 14, fontWeight: '800' },
  editorContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 44 },
  editorTitle: { color: COLORS.ink, fontSize: 31, fontWeight: '800', letterSpacing: -0.8, marginTop: 6 },
  editorSubtitle: { color: COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: 4, marginBottom: 22 },
  fieldCard: { backgroundColor: COLORS.surface, borderColor: COLORS.line, borderWidth: 1, borderRadius: 17, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  fieldLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  recipeNameInput: { minHeight: 48, color: COLORS.ink, fontSize: 18, fontWeight: '700', paddingVertical: 8 },
  modeHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 25, marginBottom: 10 },
  helperText: { color: COLORS.muted, fontSize: 12, lineHeight: 18 },
  modeControl: { flexDirection: 'row', backgroundColor: '#EAE8E0', padding: 4, borderRadius: 14, gap: 4 },
  modeButton: { flex: 1, minHeight: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  modeButtonSelected: { backgroundColor: COLORS.surface, shadowColor: '#182A20', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  modeButtonLabel: { color: COLORS.muted, fontSize: 14, fontWeight: '700' },
  modeButtonLabelSelected: { color: COLORS.green, fontWeight: '800' },
  ingredientList: { gap: 11 },
  ingredientCard: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, borderRadius: 17, padding: 14 },
  ingredientHeading: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  ingredientIndex: { color: COLORS.orange, fontSize: 11, fontWeight: '900', marginRight: 8 },
  ingredientHeadingLabel: { flex: 1, color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  removeIngredientButton: { minHeight: 36, minWidth: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  removeIngredientText: { color: COLORS.danger, fontSize: 12, fontWeight: '700' },
  ingredientNameInput: { minHeight: 43, color: COLORS.ink, fontSize: 16, fontWeight: '700', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.line, paddingVertical: 6 },
  ingredientBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12 },
  quantityField: { width: '39%', minWidth: 100 },
  quantityInputWrap: { height: 43, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.line },
  quantityInput: { flex: 1, minWidth: 35, color: COLORS.ink, fontSize: 18, fontWeight: '800', paddingVertical: 5 },
  unitLabel: { color: COLORS.muted, fontSize: 13, fontWeight: '700', paddingLeft: 5 },
  flourControl: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  flourCopy: { alignItems: 'flex-end' },
  flourLabel: { color: COLORS.ink, fontSize: 13, fontWeight: '700' },
  flourHint: { color: COLORS.muted, fontSize: 10, marginTop: 2 },
  noIngredients: { padding: 17, backgroundColor: COLORS.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C7CEC5', borderRadius: 16 },
  noIngredientsText: { color: COLORS.muted, fontSize: 14, textAlign: 'center' },
  addIngredientButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.green, borderRadius: 15, borderStyle: 'dashed', marginTop: 12 },
  addPlus: { color: COLORS.green, fontSize: 20, fontWeight: '600' },
  addIngredientLabel: { color: COLORS.green, fontSize: 14, fontWeight: '800' },
  flourNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: COLORS.greenSoft, borderRadius: 14, padding: 13, marginTop: 17 },
  flourNoteMark: { width: 19, height: 19, borderRadius: 10, overflow: 'hidden', backgroundColor: COLORS.green, color: COLORS.surface, fontSize: 12, fontWeight: '900', textAlign: 'center', textAlignVertical: 'center' },
  flourNoteText: { flex: 1, color: COLORS.green, fontSize: 12, lineHeight: 18 },
  errorBanner: { color: COLORS.danger, fontSize: 13, lineHeight: 19, backgroundColor: COLORS.dangerSoft, borderRadius: 12, padding: 12, marginTop: 13 },
  draftNote: { color: COLORS.muted, fontSize: 11, textAlign: 'center', marginTop: 14 },
  modalBackdrop: { flex: 1, justifyContent: 'center', backgroundColor: '#102018AA', padding: 24 },
  modalCard: { backgroundColor: COLORS.surface, borderRadius: 22, padding: 22, gap: 10 },
  modalEyebrow: { color: COLORS.orange, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  modalTitle: { color: COLORS.ink, fontSize: 22, fontWeight: '800' },
  modalBody: { color: COLORS.muted, fontSize: 14, lineHeight: 21 },
  baseInput: { minHeight: 50, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingHorizontal: 13, color: COLORS.ink, fontSize: 17 },
  modalActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  secondaryButton: { minHeight: 48, minWidth: 90, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  secondaryButtonText: { color: COLORS.muted, fontSize: 14, fontWeight: '700' },
});
