import { Capacitor } from '@capacitor/core'

// Hands a question to any AI app (through the share sheet) and reads its reply back from the clipboard.
// The question is also copied, so it can be pasted into an AI app that isn't in the share sheet.
export const useAi = () => ({
  async share(text: string): Promise<'shared' | 'copied'> {
    await navigator.clipboard?.writeText(text).catch(() => {})
    try {
      if (Capacitor.isNativePlatform()) {
        const { Share } = await import('@capacitor/share')
        await Share.share({ text })
        return 'shared'
      }
      if (navigator.share) {
        await navigator.share({ text })
        return 'shared'
      }
    } catch {
      // share sheet dismissed: the question is still on the clipboard
    }
    return 'copied'
  },

  // Empty string when the clipboard can't be read; the paste box is the fallback.
  async readClipboard() {
    try {
      return (await navigator.clipboard?.readText()) ?? ''
    } catch {
      return ''
    }
  }
})
