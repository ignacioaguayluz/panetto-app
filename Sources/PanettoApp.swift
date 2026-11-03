import SwiftUI

enum CalculationMode: String, CaseIterable, Codable, Identifiable {
    case weight, percentage
    var id: String { rawValue }
    var title: String { self == .weight ? "Peso" : "Porcentaje" }
}

enum IngredientTag: String, CaseIterable, Codable, Identifiable {
    case flour, liquid, sweetener, salt, yeast, fat, seed, other
    var id: String { rawValue }
    var title: String {
        switch self {
        case .flour: "Harina"; case .liquid: "Líquido"; case .sweetener: "Dulzor"; case .salt: "Sal"
        case .yeast: "Levadura"; case .fat: "Grasa"; case .seed: "Semilla"; case .other: "Otro"
        }
    }
    var symbol: String {
        switch self {
        case .flour: "wheat"; case .liquid: "drop.fill"; case .sweetener: "cube.fill"; case .salt: "circle.hexagongrid.fill"
        case .yeast: "sparkles"; case .fat: "circle.lefthalf.filled"; case .seed: "leaf.fill"; case .other: "tag.fill"
        }
    }
}

struct Ingredient: Identifiable, Codable, Hashable {
    var id = UUID()
    var name: String
    var tag: IngredientTag
    var isFlour: Bool
    /// Peso de la receta de referencia. Editar una fila nunca modifica los demás pesos.
    var weight: Double
    var percentage: Double
}

struct Recipe: Identifiable, Codable, Hashable {
    var id = UUID()
    var name: String
    var calculationMode: CalculationMode = .weight
    var ingredients: [Ingredient]
    var targetBreadCount: Double = 5
    var targetBreadWeight: Double = 1_000

    static var sample: Recipe {
        var recipe = Recipe(name: "Mi primera receta", ingredients: [
            Ingredient(name: "Harina blanca", tag: .flour, isFlour: true, weight: 400, percentage: 0),
            Ingredient(name: "Harina integral", tag: .flour, isFlour: true, weight: 100, percentage: 0),
            Ingredient(name: "Agua", tag: .liquid, isFlour: false, weight: 350, percentage: 0),
            Ingredient(name: "Sal", tag: .salt, isFlour: false, weight: 10, percentage: 0)
        ])
        recipe.recalculatePercentages()
        return recipe
    }

    var totalFlourWeight: Double { ingredients.filter(\.isFlour).reduce(0) { $0 + $1.weight } }
    var referenceDoughWeight: Double { ingredients.reduce(0) { $0 + $1.weight } }
    var targetDoughWeight: Double { max(0, targetBreadCount) * max(0, targetBreadWeight) }
    var scaleFactor: Double { referenceDoughWeight > 0 ? targetDoughWeight / referenceDoughWeight : 0 }
    func calculatedWeight(for ingredient: Ingredient) -> Double { ingredient.weight * scaleFactor }

    mutating func recalculatePercentages() {
        let flourWeight = totalFlourWeight
        for index in ingredients.indices { ingredients[index].percentage = flourWeight > 0 ? ingredients[index].weight / flourWeight * 100 : 0 }
    }

    mutating func setWeight(_ newWeight: Double, id: UUID) {
        guard let index = ingredients.firstIndex(where: { $0.id == id }) else { return }
        ingredients[index].weight = max(0, newWeight)
        recalculatePercentages()
    }

    mutating func setPercentage(_ value: Double, id: UUID) {
        guard let index = ingredients.firstIndex(where: { $0.id == id }), totalFlourWeight > 0 else { return }
        let flourWeight = totalFlourWeight
        if !ingredients[index].isFlour {
            ingredients[index].weight = flourWeight * max(0, value) / 100
        } else {
            let percentage = min(100, max(0, value))
            let others = ingredients.indices.filter { ingredients[$0].isFlour && $0 != index }
            guard !others.isEmpty else { ingredients[index].weight = flourWeight; recalculatePercentages(); return }
            let oldOthers = others.reduce(0) { $0 + ingredients[$1].weight }
            ingredients[index].weight = flourWeight * percentage / 100
            let targetOthers = flourWeight - ingredients[index].weight
            if oldOthers > 0 {
                others.forEach { ingredients[$0].weight = ingredients[$0].weight / oldOthers * targetOthers }
            } else {
                others.forEach { ingredients[$0].weight = targetOthers / Double(others.count) }
            }
        }
        recalculatePercentages()
    }
}

private struct LegacyIngredient: Codable { var id: UUID; var name: String; var isFlour: Bool; var percentage: Double }
private struct LegacyRecipe: Codable {
    var id: UUID; var name: String; var flourWeight: Double; var calculationMode: CalculationMode; var ingredients: [LegacyIngredient]
    var upgraded: Recipe {
        var recipe = Recipe(id: id, name: name, calculationMode: calculationMode, ingredients: ingredients.map {
            Ingredient(id: $0.id, name: $0.name, tag: $0.isFlour ? .flour : .other, isFlour: $0.isFlour, weight: flourWeight * $0.percentage / 100, percentage: 0)
        })
        recipe.recalculatePercentages()
        return recipe
    }
}

final class RecipeStore: ObservableObject {
    @Published var recipes: [Recipe] { didSet { save() } }
    private let storageKey = "panetto.recipes.v2"
    init() {
        if let data = UserDefaults.standard.data(forKey: storageKey), let recipes = try? JSONDecoder().decode([Recipe].self, from: data), !recipes.isEmpty {
            self.recipes = recipes
        } else if let data = UserDefaults.standard.data(forKey: "panetto.recipes.v1"), let recipes = try? JSONDecoder().decode([LegacyRecipe].self, from: data), !recipes.isEmpty {
            self.recipes = recipes.map(\.upgraded)
        } else { self.recipes = [.sample] }
        self.recipes.indices.forEach { self.recipes[$0].recalculatePercentages() }
    }
    func add() -> UUID {
        var recipe = Recipe(name: "Nueva receta", ingredients: [Ingredient(name: "Harina", tag: .flour, isFlour: true, weight: 500, percentage: 0)])
        recipe.recalculatePercentages(); recipes.append(recipe); return recipe.id
    }
    func delete(_ recipe: Recipe) { recipes.removeAll { $0.id == recipe.id } }
    private func save() { if let data = try? JSONEncoder().encode(recipes) { UserDefaults.standard.set(data, forKey: storageKey) } }
}

@main
struct PanettoApp: App {
    @StateObject private var store = RecipeStore()
    @State private var selection: UUID?
    var body: some Scene {
        WindowGroup { ContentView(selection: $selection).environmentObject(store).frame(minWidth: 980, minHeight: 660) }
            .defaultSize(width: 1_140, height: 760)
            .commands { CommandGroup(after: .newItem) { Button("Nueva receta") { selection = store.add() }.keyboardShortcut("n", modifiers: [.command]) } }
    }
}

struct ContentView: View {
    @EnvironmentObject private var store: RecipeStore
    @Binding var selection: UUID?
    var body: some View {
        NavigationSplitView {
            List(selection: $selection) {
                Section("Mis recetas") {
                    ForEach(store.recipes) { recipe in
                        Label(recipe.name, systemImage: "book.closed.fill").tag(recipe.id).contextMenu {
                            Button(role: .destructive) { let selected = selection == recipe.id; store.delete(recipe); if selected { selection = store.recipes.first?.id } } label: { Label("Eliminar receta", systemImage: "trash") }
                        }
                    }.onDelete { offsets in
                        let ids = offsets.map { store.recipes[$0].id }; store.recipes.removeAll { ids.contains($0.id) }
                        if let current = selection, !store.recipes.contains(where: { $0.id == current }) { selection = store.recipes.first?.id }
                    }
                }
            }.navigationTitle("Panetto").toolbar { Button { selection = store.add() } label: { Label("Nueva receta", systemImage: "plus") } }
        } detail: {
            if let id = selection, let index = store.recipes.firstIndex(where: { $0.id == id }) { RecipeEditor(recipe: $store.recipes[index]).id(id) }
            else { ContentUnavailableView("Elige una receta", systemImage: "frying.pan", description: Text("Crea una receta para comenzar.")) }
        }.onAppear { if selection == nil { selection = store.recipes.first?.id } }
    }
}

struct RecipeEditor: View {
    @Binding var recipe: Recipe
    @State private var hasCalculated = false
    var body: some View {
        ScrollView { VStack(alignment: .leading, spacing: 22) {
            HStack(alignment: .firstTextBaseline) {
                TextField("Nombre", text: $recipe.name).font(.system(size: 30, weight: .bold, design: .rounded)).textFieldStyle(.plain)
                Spacer()
                Picker("Editar por", selection: $recipe.calculationMode) { ForEach(CalculationMode.allCases) { Text($0.title).tag($0) } }.pickerStyle(.segmented).frame(width: 220)
            }
            HStack(spacing: 14) {
                MetricCard(title: "Harina total", value: recipe.totalFlourWeight, unit: "g", icon: "wheat")
                MetricCard(title: "Receta base", value: recipe.referenceDoughWeight, unit: "g", icon: "scalemass.fill")
                MetricCard(title: "Ingredientes", value: Double(recipe.ingredients.count), unit: "tipos", icon: "tag.fill", decimals: 0)
            }
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Ingredientes de la receta base").font(.title2.bold())
                        Text(recipe.calculationMode == .weight ? "Escribe los gramos de tu receta. Ningún otro peso cambiará mientras agregas ingredientes." : "Edita porcentajes cuando lo prefieras. La suma de las harinas se mantiene en 100%.").font(.subheadline).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button { recipe.ingredients.append(Ingredient(name: "Nuevo ingrediente", tag: .other, isFlour: false, weight: 0, percentage: 0)); recipe.recalculatePercentages(); hasCalculated = false } label: { Label("Agregar ingrediente", systemImage: "plus") }.buttonStyle(.borderedProminent)
                }
                IngredientTable(recipe: $recipe, hasCalculated: $hasCalculated)
            }
            ProductionCalculator(recipe: $recipe, hasCalculated: $hasCalculated)
        }.padding(28) }.navigationTitle(recipe.name)
    }
}

struct MetricCard: View {
    let title: String; let value: Double; let unit: String; let icon: String; var decimals: Int = 1
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon).font(.title3).foregroundStyle(.orange).frame(width: 34, height: 34).background(.orange.opacity(0.14), in: RoundedRectangle(cornerRadius: 9))
            VStack(alignment: .leading, spacing: 2) { Text(title).font(.caption).foregroundStyle(.secondary); Text("\(value, format: .number.precision(.fractionLength(decimals))) \(unit)").font(.headline) }
            Spacer(minLength: 0)
        }.padding(14).frame(maxWidth: .infinity, alignment: .leading).background(.quaternary.opacity(0.75), in: RoundedRectangle(cornerRadius: 14))
    }
}

struct IngredientTable: View {
    @Binding var recipe: Recipe; @Binding var hasCalculated: Bool
    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Text("INGREDIENTE").frame(maxWidth: .infinity, alignment: .leading); Text("ETIQUETA").frame(width: 112, alignment: .leading); Text("¿HARINA?").frame(width: 75); Text("GRAMOS").frame(width: 124, alignment: .trailing); Text("PORCENTAJE").frame(width: 118, alignment: .trailing); Color.clear.frame(width: 26)
            }.font(.caption2.weight(.semibold)).foregroundStyle(.secondary).padding(.horizontal, 14).padding(.vertical, 10).background(.quaternary.opacity(0.7))
            ForEach(recipe.ingredients.indices, id: \.self) { index in
                IngredientRow(recipe: $recipe, index: index, hasCalculated: $hasCalculated)
                if index != recipe.ingredients.indices.last { Divider().padding(.leading, 14) }
            }
        }.background(.background, in: RoundedRectangle(cornerRadius: 14)).overlay(RoundedRectangle(cornerRadius: 14).stroke(.quaternary, lineWidth: 1))
    }
}

struct IngredientRow: View {
    @Binding var recipe: Recipe; let index: Int; @Binding var hasCalculated: Bool
    var ingredient: Ingredient { recipe.ingredients[index] }
    var body: some View {
        HStack(spacing: 10) {
            TextField("Ingrediente", text: $recipe.ingredients[index].name).textFieldStyle(.plain).frame(maxWidth: .infinity, alignment: .leading)
            Picker("Etiqueta", selection: $recipe.ingredients[index].tag) { ForEach(IngredientTag.allCases) { Label($0.title, systemImage: $0.symbol).tag($0) } }.labelsHidden().pickerStyle(.menu).frame(width: 112, alignment: .leading)
            Toggle("Harina", isOn: $recipe.ingredients[index].isFlour).labelsHidden().toggleStyle(.switch).frame(width: 75).onChange(of: recipe.ingredients[index].isFlour) { _ in recipe.recalculatePercentages(); hasCalculated = false }
            if recipe.calculationMode == .weight {
                NumberInput(value: Binding(get: { ingredient.weight }, set: { recipe.setWeight($0, id: ingredient.id); hasCalculated = false }), suffix: "g").frame(width: 124)
                ResultText(value: ingredient.percentage, suffix: "%").frame(width: 118, alignment: .trailing)
            } else {
                ResultText(value: ingredient.weight, suffix: "g").frame(width: 124, alignment: .trailing)
                NumberInput(value: Binding(get: { ingredient.percentage }, set: { recipe.setPercentage($0, id: ingredient.id); hasCalculated = false }), suffix: "%").frame(width: 118)
            }
            Button(role: .destructive) { recipe.ingredients.remove(at: index); recipe.recalculatePercentages(); hasCalculated = false } label: { Image(systemName: "trash") }.buttonStyle(.plain).foregroundStyle(.secondary).frame(width: 26)
        }.padding(.horizontal, 14).padding(.vertical, 12)
    }
}

struct ProductionCalculator: View {
    @Binding var recipe: Recipe; @Binding var hasCalculated: Bool
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 3) { Text("Calcular receta").font(.title2.bold()); Text("Escala tu receta base sin modificar los pesos que anotaste arriba.").font(.subheadline).foregroundStyle(.secondary) }
                Spacer()
                Button { recipe.recalculatePercentages(); hasCalculated = true } label: { Label("Calcular receta", systemImage: "function") }.buttonStyle(.borderedProminent).disabled(recipe.referenceDoughWeight <= 0)
            }
            HStack(spacing: 16) {
                LabeledNumberInput(label: "Cantidad de panes", value: $recipe.targetBreadCount, suffix: "panes") { hasCalculated = false }
                LabeledNumberInput(label: "Peso por pan", value: $recipe.targetBreadWeight, suffix: "g") { hasCalculated = false }
                VStack(alignment: .leading, spacing: 6) { Text("Masa a producir").font(.caption).foregroundStyle(.secondary); Text("\(recipe.targetDoughWeight, format: .number.precision(.fractionLength(0))) g").font(.title3.bold().monospacedDigit()) }.padding(.horizontal, 15).padding(.vertical, 10).background(.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 10)); Spacer()
            }
            if recipe.totalFlourWeight <= 0 { Label("Marca al menos un ingrediente como harina para calcular porcentajes.", systemImage: "exclamationmark.triangle.fill").font(.footnote).foregroundStyle(.orange) }
            if hasCalculated { CalculationResult(recipe: recipe) }
        }.padding(20).background(.quaternary.opacity(0.55), in: RoundedRectangle(cornerRadius: 16))
    }
}

struct LabeledNumberInput: View {
    let label: String; @Binding var value: Double; let suffix: String; let changed: () -> Void
    var body: some View { VStack(alignment: .leading, spacing: 6) { Text(label).font(.caption).foregroundStyle(.secondary); NumberInput(value: $value, suffix: suffix).frame(width: 150).onChange(of: value) { _ in changed() } } }
}

struct CalculationResult: View {
    let recipe: Recipe
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack { Label("Resultado: \(recipe.targetBreadCount, format: .number.precision(.fractionLength(0))) panes de \(recipe.targetBreadWeight, format: .number.precision(.fractionLength(0))) g", systemImage: "checkmark.circle.fill").font(.headline).foregroundStyle(.green); Spacer(); Text("× \(recipe.scaleFactor, format: .number.precision(.fractionLength(3)))").font(.subheadline.monospacedDigit()).foregroundStyle(.secondary) }.padding(.bottom, 2)
            ForEach(recipe.ingredients) { ingredient in HStack { Label(ingredient.name.isEmpty ? "Sin nombre" : ingredient.name, systemImage: ingredient.tag.symbol); Spacer(); Text("\(ingredient.percentage, format: .number.precision(.fractionLength(2))) %").foregroundStyle(.secondary).font(.body.monospacedDigit()); Text("\(recipe.calculatedWeight(for: ingredient), format: .number.precision(.fractionLength(1))) g").font(.headline.monospacedDigit()).frame(width: 132, alignment: .trailing) }.padding(.vertical, 4) }
        }.padding(16).background(.background, in: RoundedRectangle(cornerRadius: 12))
    }
}

struct NumberInput: View {
    @Binding var value: Double; let suffix: String
    var body: some View { HStack(spacing: 3) { TextField("0", value: $value, format: .number.precision(.fractionLength(2))).multilineTextAlignment(.trailing).textFieldStyle(.roundedBorder); Text(suffix).font(.caption).foregroundStyle(.secondary) } }
}

struct ResultText: View {
    let value: Double; let suffix: String
    var body: some View { Text("\(value, format: .number.precision(.fractionLength(2))) \(suffix)").font(.body.monospacedDigit()).foregroundStyle(.secondary) }
}
