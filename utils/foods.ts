import type { Nutrients } from './nutrition'

export interface Food {
  id?: number // custom foods only
  name: string
  ar?: string // Arabic name, also searchable
  per100: Nutrients
  servingG?: number
  servingLabel?: string
  perServing?: boolean
  custom?: boolean
}

// Built-in foods, values per 100 g as eaten (cooked where it applies).
// Mostly USDA averages; Egyptian home dishes are typical-recipe estimates, so treat them as close, not exact.
// Columns: kcal, protein g, carbs g, fat g, fiber g, sugar g, sodium mg, then a common serving.
type Row = [name: string, ar: string, n: [number, number, number, number, number, number, number], servingG?: number, servingLabel?: string]

const ROWS: Row[] = [
  // Eggs, meat, fish
  ['Egg, whole', 'بيض', [143, 12.6, 0.7, 9.5, 0, 0.4, 142], 50, 'egg'],
  ['Egg white', 'بياض بيض', [52, 10.9, 0.7, 0.2, 0, 0.7, 166], 33, 'egg white'],
  ['Chicken breast, grilled', 'صدور فراخ مشوية', [165, 31, 0, 3.6, 0, 0, 74], 150, 'portion'],
  ['Chicken thigh, cooked', 'وراك فراخ', [209, 26, 0, 10.9, 0, 0, 84], 120, 'thigh'],
  ['Chicken, roasted with skin', 'فراخ مشوية بالجلد', [239, 27.3, 0, 13.6, 0, 0, 82], 200, 'quarter'],
  ['Chicken, fried (breaded)', 'فراخ بانيه / مقلية', [260, 24.8, 9, 13.2, 0.3, 0, 275], 120, 'piece'],
  ['Chicken shawarma (meat)', 'شاورما فراخ', [210, 22, 3, 12, 0.3, 1, 600], 150, 'portion'],
  ['Beef, lean, cooked', 'لحمة حمرا', [217, 26, 0, 11.8, 0, 0, 72], 150, 'portion'],
  ['Kofta, grilled', 'كفتة مشوية', [250, 18, 4, 18, 0.5, 1, 450], 100, 'portion'],
  ['Beef liver, cooked', 'كبدة', [175, 27, 5, 4.7, 0, 0, 79], 150, 'portion'],
  ['Turkey breast slices', 'لانشون تركي', [104, 17, 4, 2, 0, 3, 1000], 30, 'slice'],
  ['Tuna in water, drained', 'تونة مياه', [116, 25.5, 0, 0.8, 0, 0, 338], 120, 'can'],
  ['Tuna in oil, drained', 'تونة زيت', [198, 29, 0, 8.2, 0, 0, 354], 120, 'can'],
  ['Salmon, cooked', 'سلمون', [206, 22, 0, 12, 0, 0, 61], 150, 'fillet'],
  ['Tilapia, grilled', 'بلطي مشوي', [128, 26, 0, 2.7, 0, 0, 56], 150, 'fish'],
  ['Shrimp, cooked', 'جمبري', [99, 24, 0.2, 0.3, 0, 0, 111], 100, 'portion'],

  // Egyptian dishes
  ['Ful medames (with oil)', 'فول مدمس', [140, 7.5, 17, 4.5, 5.5, 1, 300], 200, 'plate'],
  ["Ta'meya (falafel)", 'طعمية', [333, 13.3, 31.8, 17.8, 4.9, 0, 294], 30, 'piece'],
  ['Koshari', 'كشري', [150, 5, 27, 2.5, 3, 2, 250], 350, 'bowl'],
  ['Molokhia', 'ملوخية', [50, 2.5, 4, 2.5, 2, 0.5, 300], 250, 'bowl'],
  ['Mahshi (stuffed vegetables)', 'محشي', [140, 2.5, 20, 5.5, 2, 2, 300], 200, 'plate'],
  ['Fattah', 'فتة', [210, 9, 22, 9, 1, 0.5, 400], 350, 'plate'],
  ['Lentil soup', 'شوربة عدس', [90, 5, 13, 2, 3, 1.5, 300], 300, 'bowl'],
  ['White beans stew', 'فاصوليا بيضا', [95, 4, 12, 3, 4, 3, 300], 250, 'plate'],
  ['Okra stew (bamia)', 'بامية', [110, 7, 8, 6, 3, 3, 300], 250, 'plate'],
  ['Feteer meshaltet', 'فطير مشلتت', [400, 7, 40, 24, 1.5, 1, 350], 100, 'slice'],
  ['Hawawshi', 'حواوشي', [290, 13, 25, 15, 1.5, 1.5, 500], 200, 'loaf'],
  ['Shawarma sandwich', 'سندوتش شاورما', [230, 12, 25, 9, 1.5, 2, 550], 250, 'sandwich'],
  ['Hummus', 'حمص بطحينة', [166, 7.9, 14.3, 9.6, 6, 0.3, 379], 50, 'portion'],
  ['Tahini paste', 'طحينة خام', [595, 17, 21, 54, 9.3, 0.5, 115], 15, 'tbsp'],
  ['Tahini salad', 'سلطة طحينة', [270, 8, 9, 24, 4, 0.5, 300], 30, 'tbsp'],
  ['Baba ghanoush', 'بابا غنوج', [110, 2.5, 8, 8, 3, 3, 300], 60, 'portion'],
  ['Green salad (no oil)', 'سلطة خضرا', [20, 0.9, 4, 0.2, 1.2, 2.5, 5], 150, 'bowl'],

  // Bread, grains, starches
  ['Baladi bread', 'عيش بلدي', [262, 9.8, 55, 2.6, 7.4, 0.8, 527], 90, 'loaf'],
  ['Shami / white pita', 'عيش شامي', [275, 9.1, 55.7, 1.2, 2.2, 1.3, 536], 60, 'loaf'],
  ['Toast, white', 'توست أبيض', [265, 9, 49, 3.2, 2.7, 5, 491], 28, 'slice'],
  ['Toast, brown', 'توست بني', [247, 13, 41, 3.4, 7, 6, 450], 30, 'slice'],
  ['Croissant', 'كرواسون', [406, 8.2, 45.8, 21, 2.6, 11.3, 467], 60, 'croissant'],
  ['Rice, white, cooked', 'رز أبيض', [130, 2.7, 28, 0.3, 0.4, 0, 1], 180, 'cup'],
  ['Rice with vermicelli', 'رز بالشعرية', [160, 3, 29, 3.5, 0.5, 0, 200], 200, 'plate'],
  ['Rice, brown, cooked', 'رز بني', [123, 2.7, 25.6, 1, 1.6, 0.2, 4], 180, 'cup'],
  ['Pasta, cooked', 'مكرونة', [158, 5.8, 30.9, 0.9, 1.8, 0.6, 1], 200, 'plate'],
  ['Oats, dry', 'شوفان', [389, 16.9, 66.3, 6.9, 10.6, 1, 2], 40, 'portion'],
  ['Corn flakes', 'كورن فليكس', [357, 7.5, 84, 0.4, 3.3, 9.5, 729], 30, 'bowl'],
  ['Granola', 'جرانولا', [450, 11, 64, 17, 6, 22, 40], 50, 'portion'],
  ['Potato, boiled', 'بطاطس مسلوقة', [87, 1.9, 20.1, 0.1, 1.8, 0.9, 4], 150, 'potato'],
  ['French fries', 'بطاطس محمرة', [312, 3.4, 41, 15, 3.8, 0.3, 210], 120, 'portion'],
  ['Sweet potato, baked', 'بطاطا', [90, 2, 20.7, 0.2, 3.3, 6.5, 36], 150, 'sweet potato'],
  ['Chickpeas, cooked', 'حمص مسلوق', [164, 8.9, 27.4, 2.6, 7.6, 4.8, 7], 160, 'cup'],
  ['Lentils, cooked', 'عدس', [116, 9, 20.1, 0.4, 7.9, 1.8, 2], 200, 'cup'],
  ['Pizza margherita', 'بيتزا', [266, 11, 33, 10, 2.3, 3.6, 598], 100, 'slice'],
  ['Burger sandwich', 'برجر', [254, 12.9, 29.3, 9.5, 1.2, 5.8, 497], 150, 'burger'],

  // Dairy
  ['Milk, full fat', 'لبن كامل الدسم', [61, 3.2, 4.8, 3.3, 0, 5.1, 43], 250, 'glass'],
  ['Milk, skim', 'لبن خالي الدسم', [34, 3.4, 5, 0.1, 0, 5, 42], 250, 'glass'],
  ['Yogurt, plain', 'زبادي', [61, 3.5, 4.7, 3.3, 0, 4.7, 46], 105, 'cup'],
  ['Greek yogurt, nonfat', 'زبادي يوناني', [59, 10.2, 3.6, 0.4, 0, 3.2, 36], 170, 'cup'],
  ['White cheese (Domiati / feta)', 'جبنة بيضا', [264, 14.2, 4.1, 21.3, 0, 4.1, 1116], 30, 'portion'],
  ['Areesh cheese', 'جبنة قريش', [95, 14, 3.5, 2.5, 0, 3, 400], 100, 'portion'],
  ['Rumi cheese', 'جبنة رومي', [370, 26, 2, 28, 0, 0.5, 1200], 30, 'slice'],
  ['Cheddar', 'شيدر', [403, 24.9, 1.3, 33.1, 0, 0.5, 621], 20, 'slice'],
  ['Labneh', 'لبنة', [170, 7, 4.5, 14, 0, 4, 450], 30, 'tbsp'],
  ['Triangle cheese', 'جبنة مثلثات', [240, 10, 6, 20, 0, 6, 1000], 16, 'triangle'],
  ['Whey protein powder', 'واي بروتين', [400, 80, 8, 6, 0, 4, 200], 30, 'scoop'],

  // Fruit and vegetables
  ['Banana', 'موز', [89, 1.1, 22.8, 0.3, 2.6, 12.2, 1], 118, 'banana'],
  ['Apple', 'تفاح', [52, 0.3, 13.8, 0.2, 2.4, 10.4, 1], 180, 'apple'],
  ['Orange', 'برتقال', [47, 0.9, 11.8, 0.1, 2.4, 9.4, 0], 140, 'orange'],
  ['Dates', 'بلح / تمر', [277, 1.8, 75, 0.2, 6.7, 66.5, 1], 10, 'date'],
  ['Guava', 'جوافة', [68, 2.6, 14.3, 1, 5.4, 8.9, 2], 100, 'guava'],
  ['Mango', 'مانجو', [60, 0.8, 15, 0.4, 1.6, 13.7, 1], 200, 'mango'],
  ['Watermelon', 'بطيخ', [30, 0.6, 7.6, 0.2, 0.4, 6.2, 1], 300, 'slice'],
  ['Grapes', 'عنب', [69, 0.7, 18, 0.2, 0.9, 15.5, 2], 150, 'cup'],
  ['Strawberries', 'فراولة', [32, 0.7, 7.7, 0.3, 2, 4.9, 1], 150, 'cup'],
  ['Avocado', 'أفوكادو', [160, 2, 8.5, 14.7, 6.7, 0.7, 7], 100, 'half'],
  ['Tomato', 'طماطم', [18, 0.9, 3.9, 0.2, 1.2, 2.6, 5], 120, 'tomato'],
  ['Cucumber', 'خيار', [15, 0.7, 3.6, 0.1, 0.5, 1.7, 2], 150, 'cucumber'],
  ['Broccoli, cooked', 'بروكلي', [35, 2.4, 7.2, 0.4, 3.3, 1.4, 41], 150, 'cup'],
  ['Mixed vegetables, cooked', 'خضار مشكل', [65, 2.9, 13, 0.2, 4.4, 3, 35], 150, 'cup'],

  // Nuts, fats, sweets
  ['Peanut butter', 'زبدة فول سوداني', [588, 25, 20, 50, 6, 9.2, 459], 16, 'tbsp'],
  ['Almonds', 'لوز', [579, 21.2, 21.6, 49.9, 12.5, 4.4, 1], 28, 'handful'],
  ['Peanuts, roasted', 'سوداني', [585, 23.7, 21.5, 49.7, 8, 4.2, 6], 28, 'handful'],
  ['Olive oil', 'زيت زيتون', [884, 0, 0, 100, 0, 0, 2], 14, 'tbsp'],
  ['Butter', 'زبدة', [717, 0.9, 0.1, 81, 0, 0.1, 643], 10, 'tsp'],
  ['Ghee', 'سمنة', [900, 0, 0, 99.5, 0, 0, 2], 10, 'tsp'],
  ['Sugar', 'سكر', [387, 0, 100, 0, 0, 100, 1], 5, 'tsp'],
  ['Honey', 'عسل', [304, 0.3, 82.4, 0, 0.2, 82.1, 4], 21, 'tbsp'],
  ['Jam', 'مربى', [278, 0.4, 69, 0.1, 1.1, 48.5, 32], 20, 'tbsp'],
  ['Halawa (tahini halva)', 'حلاوة طحينية', [469, 12.5, 60.5, 21.5, 4.5, 50, 195], 30, 'portion'],
  ['Basbousa', 'بسبوسة', [380, 5, 58, 14, 1, 40, 150], 80, 'piece'],
  ['Om Ali', 'أم علي', [250, 6, 28, 13, 1, 18, 120], 200, 'bowl'],
  ['Konafa', 'كنافة', [400, 6, 50, 20, 1.5, 25, 200], 100, 'piece'],
  ['Dark chocolate 70%', 'شوكولاتة داكنة', [598, 7.8, 45.9, 42.6, 10.9, 24, 20], 20, 'portion'],
  ['Milk chocolate', 'شوكولاتة باللبن', [535, 7.7, 59.4, 29.7, 3.4, 51.5, 79], 40, 'bar'],

  // Drinks
  ['Tea, no sugar', 'شاي سادة', [1, 0, 0.3, 0, 0, 0, 3], 250, 'cup'],
  ['Tea with 2 tsp sugar', 'شاي بسكر', [16, 0, 4, 0, 0, 4, 3], 250, 'cup'],
  ['Coffee, black', 'قهوة', [2, 0.3, 0, 0, 0, 0, 2], 250, 'cup'],
  ['Cola', 'كولا', [42, 0, 10.6, 0, 0, 10.6, 4], 330, 'can'],
  ['Orange juice', 'عصير برتقال', [45, 0.7, 10.4, 0.2, 0.2, 8.4, 1], 250, 'glass'],
  ['Sugarcane juice', 'عصير قصب', [73, 0.2, 18, 0, 0, 18, 10], 300, 'glass']
]

export const FOODS: Food[] = ROWS.map(([name, ar, [kcal, protein, carbs, fat, fiber, sugar, sodium], servingG, servingLabel]) => ({
  name,
  ar,
  per100: { kcal, protein, carbs, fat, fiber, sugar, sodium },
  servingG,
  servingLabel
}))

// Case- and accent-insensitive; also ignores Arabic hamza/ta-marbuta variants.
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f\u064b-\u0655]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/['’]/g, '')

export function matches(food: Food, query: string) {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  const hay = normalize(`${food.name} ${food.ar ?? ''}`)
  return words.every((w) => hay.includes(w))
}
