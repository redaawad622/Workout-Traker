<script setup lang="ts" generic="T">
// "Ask AI" in two taps: send the question to any AI app, then paste its reply back.
const props = defineProps<{ prompt: string; parse: (text: string) => T; disabled?: boolean }>()
const emit = defineEmits<{ result: [value: T] }>()
const ai = useAi()

const asked = ref<'' | 'shared' | 'copied'>('')
const pasted = ref('')
const error = ref('')

async function ask() {
  error.value = ''
  asked.value = await ai.share(props.prompt)
}

function use(text: string) {
  error.value = ''
  try {
    emit('result', props.parse(text))
    asked.value = ''
    pasted.value = ''
  } catch (e) {
    error.value = (e as Error).message
  }
}

const box = ref<HTMLTextAreaElement>()
async function paste() {
  const text = await ai.readClipboard()
  if (text.includes('{')) return use(text)
  asked.value ||= 'copied'
  error.value = text ? "That isn't the AI's answer. Copy its whole reply first." : 'Paste the reply in the box below.'
  await nextTick()
  box.value?.focus()
}
watch(pasted, (t) => t.includes('}') && use(t))
</script>

<template>
  <div class="flex flex-none flex-col gap-2">
    <div class="grid grid-cols-2 gap-2">
      <button
        type="button"
        :disabled="disabled"
        class="flex h-11 items-center justify-center gap-1.5 rounded-md text-sm shadow-[inset_0_0_0_1px_theme(colors.accent.DEFAULT)]"
        :class="disabled ? 'text-neutral-500 opacity-60' : 'text-accent-300 active:bg-accent-900'"
        @click="ask"
      >
        <i class="ph ph-sparkle" />Ask AI
      </button>
      <button
        type="button"
        class="flex h-11 items-center justify-center gap-1.5 rounded-md text-sm text-neutral-200 shadow-[inset_0_0_0_1px_theme(colors.neutral.700)] active:bg-neutral-900"
        @click="paste"
      >
        <i class="ph ph-clipboard-text" />Paste answer
      </button>
    </div>
    <p v-if="asked" class="text-xs leading-[1.45] text-neutral-400">
      <template v-if="asked === 'shared'">In your AI app, copy the whole reply, come back, and tap Paste answer.</template>
      <template v-else>Question copied. Paste it in your AI app (Claude, ChatGPT, Gemini…), copy the whole reply, come back, and tap Paste answer.</template>
    </p>
    <textarea
      v-if="asked"
      ref="box"
      v-model="pasted"
      rows="2"
      placeholder="…or paste the AI's reply here"
      aria-label="AI reply"
      class="rounded-md bg-bg px-3 py-2 text-sm shadow-sm placeholder:text-neutral-600 focus:shadow-[0_0_0_1px_theme(colors.accent.DEFAULT)]"
    />
    <p v-if="error" role="alert" class="text-sm leading-[1.4] text-warn-text">{{ error }}</p>
  </div>
</template>
