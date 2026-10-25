<script setup lang="ts">
import type { Meal } from '~/utils/db'
import { matches, type Food } from '~/utils/foods'
import { fmtN, fmtQty, NUTRIENTS, plural, scale, SLOTS, type MealSlot, type Nutrients } from '~/utils/nutrition'
import { useDietStore } from '~/stores/diet'
import { foodPrompt, parseFood, type AiFood } from '~/utils/ai'
import { MONEY_CATEGORY, mealExpense, newMoneyUid } from '~/utils/money'

// Bottom sheet: search a food → set the amount → add. Opened with a meal it edits that meal instead.
const props = defineProps<{ date: string; slot: MealSlot; meal?: Meal }>()
const emit = defineEmits<{ close: []; saved: [text: string] }>()
const diet = useDietStore()
const account = useAccount()

const step = ref<'search' | 'amount' | 'custom'>(props.meal ? 'amount' : 'search')
const slot = ref<MealSlot>(props.meal?.slot ?? props.slot)

// ---- Search ----
const query = ref('')
const results = computed(() => {
  const q = query.value.trim()
  if (!q) return diet.recent.length ? diet.recent : diet.allFoods.slice(0, 30)
  return diet.allFoods.filter((f) => matches(f, q)).slice(0, 40)
})
const servingText = (f: Food) =>
  f.perServing ? `1 ${f.servingLabel ?? 'serving'}` : f.servingG ? `1 ${f.servingLabel} · ${f.servingG} g` : '100 g'
const servingKcal = (f: Food) => Math.round(f.per100.kcal * (f.perServing ? 1 : (f.servingG ?? 100) / 100))

async function removeCustom(f: Food) {
  if (f.id == null || !confirm(`Delete your food "${f.name}"? Meals already logged keep their values.`)) return
  await diet.removeFood(f.id)
}

// ---- Amount ----
const food = ref<Food | null>(
  props.meal
    ? { name: props.meal.name, per100: props.meal.per100, servingG: props.meal.servingG, servingLabel: props.meal.servingLabel, perServing: props.meal.perServing }
    : null
)
const mode = ref<'serving' | 'g'>(props.meal ? (props.meal.servings != null ? 'serving' : 'g') : 'serving')
const qty = ref<number | undefined>(props.meal ? (props.meal.servings ?? props.meal.grams) : 1)

function choose(f: Food) {
  food.value = f
  mode.value = f.servingG ? 'serving' : 'g'
  qty.value = f.servingG ? 1 : 100
  price.value = lastPrice(f.name)
  step.value = 'amount'
}

// ---- Price ----
// Starts at what this food cost last time. With an account, it can go straight to Money Tracker
// as an expense in the meal's category.
const price = ref<number | undefined>(props.meal?.price)
function lastPrice(name: string) {
  const prev = diet.meals.filter((m) => m.name === name && m.price).sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0))[0]
  return prev?.price
}
const priced = computed(() => typeof price.value === 'number' && price.value > 0)
const toMoney = ref(props.meal ? !!props.meal.moneyUid : true)
const canSend = computed(() => !!account.user.value)
const moneyCategory = computed(() => MONEY_CATEGORY[slot.value].name)

const canServe = computed(() => !!food.value?.servingG)
const grams = computed(() => {
  const q = qty.value ?? 0
  return mode.value === 'serving' ? q * (food.value?.servingG ?? 100) : q
})
const totals = computed<Nutrients | null>(() => (food.value ? scale(food.value.per100, grams.value) : null))

function setMode(m: 'serving' | 'g') {
  if (m === mode.value || !food.value?.servingG) return
  // Keep the same amount when switching.
  qty.value = m === 'g' ? Math.round(grams.value) : Math.round((grams.value / food.value.servingG) * 4) / 4
  mode.value = m
}
function nudge(dir: 1 | -1) {
  const stepBy = mode.value === 'serving' ? 0.5 : 10
  qty.value = Math.max(0, Math.round(((qty.value ?? 0) + dir * stepBy) * 100) / 100)
}
const unitText = computed(() =>
  mode.value === 'g' ? 'g' : plural(food.value?.servingLabel ?? 'serving', qty.value ?? 0)
)

async function save() {
  const f = food.value
  if (!f || !grams.value) return
  const record: Meal = {
    date: props.meal?.date ?? props.date,
    slot: slot.value,
    name: f.name,
    grams: Math.round(grams.value * 10) / 10,
    servings: mode.value === 'serving' ? qty.value : undefined,
    servingG: f.servingG,
    servingLabel: f.servingLabel,
    perServing: f.perServing || undefined,
    per100: { ...f.per100 },
    price: priced.value ? Math.round(price.value! * 100) / 100 : undefined,
    moneyUid: props.meal?.moneyUid
  }
  const send = priced.value && toMoney.value && canSend.value
  if (send) {
    record.moneyUid ??= newMoneyUid()
    account.sendToMoney(record.moneyUid, mealExpense({ price: record.price!, slot: record.slot, name: record.name, date: record.date }))
  }
  const sent = send ? ` · sent to Money Tracker as ${moneyCategory.value}` : ''
  if (props.meal?.id != null) {
    await diet.update(props.meal.id, record)
    emit('saved', `Updated ${f.name}${sent}`)
  } else {
    await diet.add(record)
    emit('saved', `Added ${f.name}${sent}`)
  }
  emit('close')
}

async function remove() {
  const m = props.meal
  if (m?.id == null || !confirm(`Remove ${m.name}?`)) return
  await diet.remove(m.id)
  emit('saved', `Removed ${m.name}`)
  emit('close')
}

// ---- Custom food ----
const custom = reactive({
  name: '',
  ar: '',
  servingLabel: '',
  basis: '100g' as '100g' | 'serving',
  servingG: undefined as number | undefined,
  values: { kcal: undefined, protein: undefined, carbs: undefined, fat: undefined, fiber: undefined, sugar: undefined, sodium: undefined } as Record<keyof Nutrients, number | undefined>
})
function startCustom() {
  custom.name = query.value.trim()
  custom.ar = ''
  custom.servingLabel = ''
  aiNote.value = ''
  step.value = 'custom'
}

// Optional: ask an AI app for the values, then the user checks them in the form before saving.
const aiNote = ref('')
function fillFromAi(r: AiFood) {
  custom.name = r.name || custom.name
  custom.ar = r.ar
  custom.basis = '100g'
  custom.servingG = r.servingG || undefined
  custom.servingLabel = r.servingLabel
  for (const { key } of NUTRIENTS) custom.values[key] = r.per100[key]
  aiNote.value = r.note || ' '
}
const customOk = computed(() => custom.name.trim() && custom.values.kcal != null)
async function saveCustom() {
  if (!customOk.value) return
  const raw = {} as Nutrients
  for (const { key } of NUTRIENTS) raw[key] = Number(custom.values[key]) || 0
  const size = custom.servingG && custom.servingG > 0 ? custom.servingG : undefined
  let per100 = raw
  if (custom.basis === 'serving' && size) per100 = scale(raw, (100 / size) * 100)
  const saved = await diet.addFood({
    name: custom.name.trim(),
    ar: custom.ar.trim() || undefined,
    per100,
    servingG: size ?? (custom.basis === 'serving' ? 100 : undefined),
    servingLabel: size || custom.basis === 'serving' ? custom.servingLabel.trim() || 'serving' : undefined,
    perServing: custom.basis === 'serving' && !size ? true : undefined
  })
  choose({ ...saved, custom: true })
}

const inputCls =
  'tnum h-11 w-full rounded-md bg-bg px-3 text-[15px] shadow-sm placeholder:text-neutral-600 focus:shadow-[0_0_0_1px_theme(colors.accent.DEFAULT)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none'
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-40 bg-[color-mix(in_srgb,theme(colors.bg)_70%,transparent)]" @click="emit('close')" />
    <div
      role="dialog"
      aria-label="Add food"
      class="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[calc(100dvh-80px)] max-w-2xl flex-col gap-4 rounded-t-sheet bg-surface px-5 pt-2.5 shadow-lg"
      style="padding-bottom: calc(env(safe-area-inset-bottom) + 20px)"
    >
      <span class="h-[5px] w-10 self-center rounded-sm bg-neutral-700" />

      <!-- ========== Search ========== -->
      <template v-if="step === 'search'">
        <div class="flex items-baseline justify-between">
          <span class="text-xl font-medium">Add food</span>
          <span class="text-[13px] text-neutral-400">{{ SLOTS.find((s) => s.key === slot)?.label }}</span>
        </div>
        <label class="flex h-[52px] items-center gap-2 rounded-md bg-bg px-3.5 shadow-sm focus-within:shadow-[0_0_0_1px_theme(colors.accent.DEFAULT)]">
          <i class="ph ph-magnifying-glass text-neutral-500" />
          <input v-model="query" placeholder="Search foods · ابحث" class="min-w-0 flex-1 bg-transparent text-[15px] placeholder:text-neutral-500" />
          <button v-if="query" type="button" aria-label="Clear search" class="text-neutral-500" @click="query = ''"><i class="ph ph-x-circle text-lg" /></button>
        </label>
        <div class="-mx-5 flex-1 overflow-y-auto px-5">
          <span v-if="!query.trim() && diet.recent.length" class="label">Recent</span>
          <p v-if="!results.length" class="py-4 text-[15px] text-neutral-400">No match for “{{ query.trim() }}”. Add it as your own food below.</p>
          <ul>
            <li v-for="(f, i) in results" :key="(f.custom ? 'c' : '') + f.name" class="flex items-center gap-2" :class="i < results.length - 1 && 'shadow-hairline-dim'">
              <button type="button" class="flex min-h-14 flex-1 items-center gap-3 text-left" @click="choose(f)">
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="truncate text-base">{{ f.name }}<span v-if="f.custom" class="ml-1.5 text-[11px] text-accent-400">mine</span></span>
                  <span class="truncate text-xs text-neutral-400"><span v-if="f.ar" dir="rtl">{{ f.ar }} · </span>{{ servingText(f) }}</span>
                </span>
                <span class="tnum flex-none text-[13px] text-neutral-300">{{ servingKcal(f) }} kcal</span>
              </button>
              <button v-if="f.custom" type="button" :aria-label="`Delete ${f.name}`" class="flex size-9 flex-none items-center justify-center text-neutral-500" @click="removeCustom(f)">
                <i class="ph ph-trash" />
              </button>
            </li>
          </ul>
        </div>
        <button type="button" class="btn-outline h-[52px] text-[15px]" @click="startCustom">
          <i class="ph ph-plus" />{{ query.trim() ? `Add “${query.trim()}” as my food` : 'Add my own food' }}
        </button>
      </template>

      <!-- ========== Amount ========== -->
      <template v-else-if="step === 'amount' && food && totals">
        <div class="flex items-start gap-2">
          <button v-if="!meal" type="button" aria-label="Back to search" class="-ml-2 flex size-10 flex-none items-center justify-center text-xl text-neutral-300" @click="step = 'search'">
            <i class="ph ph-caret-left" />
          </button>
          <div class="flex min-w-0 flex-col gap-0.5 pt-1.5">
            <span class="text-xl font-medium leading-tight">{{ food.name }}</span>
            <span v-if="food.ar" dir="rtl" class="self-start text-sm text-neutral-400">{{ food.ar }}</span>
          </div>
        </div>

        <!-- Slot -->
        <div class="grid grid-cols-4 gap-1 rounded-md bg-neutral-900 p-[3px]" role="radiogroup" aria-label="Meal">
          <button
            v-for="s in SLOTS"
            :key="s.key"
            type="button"
            role="radio"
            :aria-checked="slot === s.key"
            class="flex h-[34px] items-center justify-center rounded-[6px] text-[13px]"
            :class="slot === s.key ? 'bg-accent-800 font-medium text-accent-200' : 'text-neutral-400'"
            @click="slot = s.key"
          >
            {{ s.label }}
          </button>
        </div>

        <!-- Quantity -->
        <div class="flex flex-col gap-2.5">
          <div class="flex items-center justify-between">
            <span class="label">Amount</span>
            <div v-if="canServe && !food.perServing" class="flex rounded-md bg-neutral-900 p-[3px]" role="radiogroup" aria-label="Unit">
              <button
                v-for="m in (['serving', 'g'] as const)"
                :key="m"
                type="button"
                role="radio"
                :aria-checked="mode === m"
                class="flex h-[30px] min-w-[52px] items-center justify-center rounded-[6px] px-2 text-[13px]"
                :class="mode === m ? 'bg-accent-800 font-medium text-accent-200' : 'text-neutral-400'"
                @click="setMode(m)"
              >
                {{ m === 'g' ? 'grams' : food.servingLabel }}
              </button>
            </div>
          </div>
          <div class="flex items-center justify-between gap-3">
            <button type="button" aria-label="Less" class="card flex size-14 flex-none items-center justify-center text-2xl active:bg-neutral-900" @click="nudge(-1)">
              <i class="ph ph-minus" />
            </button>
            <div class="flex min-w-0 flex-col items-center">
              <label class="tnum flex items-baseline text-[48px] font-medium leading-none tracking-[-0.02em]">
                <input
                  v-model.number="qty"
                  type="number"
                  step="any"
                  inputmode="decimal"
                  aria-label="Amount"
                  class="bg-transparent text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  :style="{ width: `${String(qty ?? '').length * 0.62 + 0.4}em` }"
                />
                <span class="ml-1.5 text-lg font-normal tracking-normal text-neutral-400">{{ unitText }}</span>
              </label>
              <span v-if="mode === 'serving' && !food.perServing" class="tnum mt-1 text-sm text-neutral-500">{{ fmtQty(grams) }} g</span>
            </div>
            <button type="button" aria-label="More" class="card flex size-14 flex-none items-center justify-center text-2xl active:bg-neutral-900" @click="nudge(1)">
              <i class="ph ph-plus" />
            </button>
          </div>
        </div>

        <!-- What this adds -->
        <div class="tnum grid grid-cols-4 gap-2 rounded-lg p-3 shadow-[inset_0_0_0_1px_theme(colors.neutral.800)]">
          <div v-for="n in NUTRIENTS.slice(0, 4)" :key="n.key" class="flex flex-col">
            <span class="text-[22px] font-medium" :class="n.key === 'kcal' ? 'text-accent-300' : n.key === 'protein' && 'text-ink'">{{ fmtN(totals[n.key], n.key) }}</span>
            <span class="text-xs text-neutral-400">{{ n.key === 'kcal' ? 'kcal' : `${n.label} g` }}</span>
          </div>
          <div class="col-span-4 flex gap-4 pt-1 text-xs text-neutral-400">
            <span v-for="n in NUTRIENTS.slice(4)" :key="n.key">{{ n.label }} <span class="text-neutral-200">{{ fmtN(totals[n.key], n.key) }} {{ n.unit }}</span></span>
          </div>
        </div>

        <!-- Price, and sending it to Money Tracker -->
        <div class="flex flex-col gap-1">
          <label class="flex min-h-12 items-center justify-between gap-3">
            <span class="text-[15px]">Price <span class="text-neutral-500">(optional)</span></span>
            <span class="flex items-center gap-2">
              <span v-if="account.moneyCurrency.value" class="text-[15px] text-neutral-400">{{ account.moneyCurrency.value }}</span>
              <input v-model.number="price" type="number" step="any" min="0" inputmode="decimal" placeholder="—" aria-label="Price" :class="[inputCls, '!w-28 text-right']" />
            </span>
          </label>
          <label v-if="priced && canSend" class="flex min-h-12 cursor-pointer items-center justify-between gap-3">
            <span class="text-[15px]">{{ meal?.moneyUid ? 'Update' : 'Add' }} in Money Tracker · <span class="text-neutral-400">{{ moneyCategory }}</span></span>
            <input v-model="toMoney" type="checkbox" class="peer sr-only" />
            <span
              class="relative h-8 w-[52px] flex-none rounded-2xl transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
              :class="toMoney ? 'bg-accent-700' : 'bg-neutral-800'"
            >
              <span class="absolute left-[3px] top-[3px] size-[26px] rounded-[13px] transition-transform" :class="toMoney ? 'translate-x-5 bg-accent-200' : 'bg-neutral-400'" />
            </span>
          </label>
          <p v-else-if="priced" class="text-xs text-neutral-500">Sign in on the Data tab, with the same account as Money Tracker, to add it there too.</p>
        </div>

        <div class="flex gap-2">
          <button
            v-if="meal"
            type="button"
            aria-label="Remove"
            class="flex h-14 w-14 flex-none items-center justify-center rounded-lg text-xl text-neutral-300 shadow-[inset_0_0_0_1px_theme(colors.neutral.700)] active:bg-neutral-900"
            @click="remove"
          >
            <i class="ph ph-trash" />
          </button>
          <button
            type="button"
            :disabled="!grams"
            class="flex h-14 flex-1 items-center justify-center gap-2 rounded-lg text-[17px] font-medium"
            :class="grams ? 'bg-accent-900 text-accent-100 shadow-[inset_0_0_0_1.5px_theme(colors.accent.DEFAULT)] active:bg-accent-800' : 'text-neutral-500 shadow-[inset_0_0_0_1.5px_theme(colors.neutral.700)]'"
            @click="save"
          >
            <i class="ph-bold ph-check" />{{ meal ? 'Update' : 'Add' }} · {{ Math.round(totals.kcal) }} kcal
          </button>
        </div>
      </template>

      <!-- ========== Custom food ========== -->
      <form v-else-if="step === 'custom'" class="-mx-5 flex flex-col gap-3.5 overflow-y-auto px-5" @submit.prevent="saveCustom">
        <div class="flex items-center gap-2">
          <button type="button" aria-label="Back to search" class="-ml-2 flex size-10 flex-none items-center justify-center text-xl text-neutral-300" @click="step = 'search'">
            <i class="ph ph-caret-left" />
          </button>
          <span class="text-xl font-medium">My food</span>
        </div>
        <input v-model="custom.name" placeholder="Name, e.g. Mom's molokhia" aria-label="Food name" :class="[inputCls, 'flex-none']" />
        <AskAi :prompt="foodPrompt(custom.name.trim())" :parse="parseFood" :disabled="!custom.name.trim()" @result="fillFromAi" />
        <p v-if="aiNote" class="flex gap-2 rounded-md p-3 text-sm leading-[1.4] text-neutral-300 shadow-[inset_0_0_0_1px_theme(colors.neutral.800)]">
          <i class="ph ph-sparkle flex-none text-accent-400" /><span>Filled by AI. Check the values, then save. {{ aiNote }}</span>
        </p>

        <div class="flex flex-col gap-2">
          <span class="label">Values are for</span>
          <div class="grid grid-cols-2 gap-1 rounded-md bg-neutral-900 p-[3px]" role="radiogroup" aria-label="Values are for">
            <button
              v-for="b in (['100g', 'serving'] as const)"
              :key="b"
              type="button"
              role="radio"
              :aria-checked="custom.basis === b"
              class="flex h-[34px] items-center justify-center rounded-[6px] text-[13px]"
              :class="custom.basis === b ? 'bg-accent-800 font-medium text-accent-200' : 'text-neutral-400'"
              @click="custom.basis = b"
            >
              {{ b === '100g' ? '100 g (label)' : 'One serving' }}
            </button>
          </div>
        </div>
        <label class="flex items-center justify-between gap-3">
          <span class="text-[15px]">Serving size <span class="text-neutral-500">(g, optional)</span></span>
          <input v-model.number="custom.servingG" type="number" inputmode="decimal" placeholder="—" :class="[inputCls, '!w-24 text-right']" />
        </label>

        <div class="grid grid-cols-2 gap-x-3 gap-y-2.5">
          <label v-for="n in NUTRIENTS" :key="n.key" class="flex flex-col gap-1">
            <span class="text-xs text-neutral-400">{{ n.label }} ({{ n.unit }})<span v-if="n.key === 'kcal'" class="text-accent-400"> *</span></span>
            <input v-model.number="custom.values[n.key]" type="number" step="any" inputmode="decimal" placeholder="0" :class="inputCls" />
          </label>
        </div>

        <button
          :disabled="!customOk"
          class="mt-1 flex h-14 items-center justify-center gap-2 rounded-lg text-[17px] font-medium"
          :class="customOk ? 'bg-accent-900 text-accent-100 shadow-[inset_0_0_0_1.5px_theme(colors.accent.DEFAULT)] active:bg-accent-800' : 'text-neutral-500 shadow-[inset_0_0_0_1.5px_theme(colors.neutral.700)]'"
        >
          <i class="ph-bold ph-check" />Save and continue
        </button>
      </form>
    </div>
  </Teleport>
</template>
