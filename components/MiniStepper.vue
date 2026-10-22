<script setup lang="ts">
const props = defineProps<{ label: string; min?: number }>()
const model = defineModel<number>({ required: true })
const dec = () => (model.value = Math.max(props.min ?? 1, (model.value || 0) - 1))
const inc = () => (model.value = (model.value || 0) + 1)
</script>

<template>
  <div class="card flex flex-col gap-2 p-3">
    <span class="label">{{ label }}</span>
    <div class="flex items-center justify-between">
      <button type="button" :aria-label="`Fewer ${label.toLowerCase()}`" class="flex size-11 items-center justify-center rounded-md bg-neutral-900 text-lg active:bg-neutral-800" @click="dec">
        <i class="ph ph-minus" />
      </button>
      <input
        v-model.number="model"
        type="number"
        inputmode="numeric"
        :aria-label="label"
        class="tnum w-14 bg-transparent text-center text-[32px] font-medium [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button type="button" :aria-label="`More ${label.toLowerCase()}`" class="flex size-11 items-center justify-center rounded-md bg-neutral-900 text-lg active:bg-neutral-800" @click="inc">
        <i class="ph ph-plus" />
      </button>
    </div>
  </div>
</template>
