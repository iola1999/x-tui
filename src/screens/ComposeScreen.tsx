import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Box,
  Text,
  useInput,
  useKeybinding,
  useRegisterKeybindingContext,
} from '@anthropic/ink'
import { postTweet, quoteTweet, replyTweet } from '../services/twitterCli.js'
import { pop, push, showToast, type ComposeMode } from '../state/store.js'
import { invalidateList } from '../state/listCache.js'
import { TW_BLUE, TW_DIM, TW_SUBTLE } from '../theme/twitterTheme.js'
import { Author } from '../components/Author.js'
import { TweetText } from '../components/TweetText.js'

const MAX_CHARS = 280
const MAX_IMAGES = 4

/**
 * Multiline tweet composer. Used for new tweets, replies, and quote tweets.
 *
 * Keyboard:
 *   - Any printable character appends to the text (paste too)
 *   - Enter inserts a newline; Ctrl+Enter submits
 *   - Backspace deletes one character
 *   - Ctrl+I appends an image path (inline prompt)
 *   - Esc cancels
 */
export function ComposeScreen({ mode }: { mode: ComposeMode }): React.ReactNode {
  useRegisterKeybindingContext('Compose', true)
  const [text, setText] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [imgPromptOpen, setImgPromptOpen] = useState(false)
  const [imgPrompt, setImgPrompt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submittingRef = useRef(false)

  const title =
    mode.kind === 'reply'
      ? `Reply to @${mode.inReplyTo.author}`
      : mode.kind === 'quote'
        ? `Quote @${mode.quoted.author}`
        : 'Compose tweet'

  const submit = useCallback(async () => {
    if (submittingRef.current) return
    if (!text.trim() && images.length === 0) {
      showToast('error', 'Empty tweet.')
      return
    }
    if (text.length > MAX_CHARS) {
      showToast('error', `Too long (${text.length}/${MAX_CHARS}).`)
      return
    }
    submittingRef.current = true
    setSubmitting(true)
    try {
      if (mode.kind === 'reply') {
        await replyTweet(mode.inReplyTo.id, text, { images })
      } else if (mode.kind === 'quote') {
        await quoteTweet(mode.quoted.id, text, { images })
      } else {
        await postTweet(text, { images })
      }
      // Invalidate feeds so they refresh on next mount.
      invalidateList('feed')
      if (mode.kind === 'reply') invalidateList(`replies:${mode.inReplyTo.id}`)
      showToast('success', 'Posted.')
      pop()
    } catch (e) {
      setError((e as Error).message)
      showToast('error', `Post failed: ${(e as Error).message}`)
      submittingRef.current = false
      setSubmitting(false)
    }
  }, [mode, text, images])

  const addImage = useCallback(() => {
    if (images.length >= MAX_IMAGES) {
      showToast('error', `Max ${MAX_IMAGES} images per tweet.`)
      return
    }
    setImgPromptOpen(true)
    setImgPrompt('')
  }, [images.length])

  useKeybinding('compose:submit', () => void submit(), { context: 'Compose' })
  useKeybinding('compose:addImage', addImage, { context: 'Compose' })
  useKeybinding(
    'compose:cancel',
    () => {
      if (imgPromptOpen) {
        setImgPromptOpen(false)
      } else {
        pop()
      }
    },
    { context: 'Compose' },
  )

  // Main text input.
  useInput(
    (input, key, event) => {
      if (submitting || imgPromptOpen) return
      if (key.ctrl && (input === '\r' || input === '\n' || key.return)) {
        // Ctrl+Enter handled by compose:submit binding too; this is a
        // safety net for terminals that don't surface ctrl+return through
        // the keybinding resolver.
        void submit()
        event.stopImmediatePropagation()
        return
      }
      if (key.return && !key.ctrl) {
        setText(t => t + '\n')
        event.stopImmediatePropagation()
        return
      }
      if (key.backspace || key.delete) {
        setText(t => t.slice(0, -1))
        event.stopImmediatePropagation()
        return
      }
      if (input && !key.ctrl && !key.meta) {
        setText(t => t + input)
        event.stopImmediatePropagation()
      }
    },
    { isActive: !submitting && !imgPromptOpen },
  )

  // Image path input.
  useInput(
    (input, key, event) => {
      if (!imgPromptOpen) return
      if (key.escape) {
        setImgPromptOpen(false)
        event.stopImmediatePropagation()
        return
      }
      if (key.return) {
        const path = imgPrompt.trim()
        if (path) setImages(imgs => [...imgs, path])
        setImgPromptOpen(false)
        event.stopImmediatePropagation()
        return
      }
      if (key.backspace || key.delete) {
        setImgPrompt(p => p.slice(0, -1))
        event.stopImmediatePropagation()
        return
      }
      if (input && !key.ctrl && !key.meta) {
        setImgPrompt(p => p + input)
        event.stopImmediatePropagation()
      }
    },
    { isActive: imgPromptOpen },
  )

  const remaining = MAX_CHARS - text.length
  const over = remaining < 0

  return (
    <Box flexDirection="column" flexGrow={1} padding={1}>
      <Box flexShrink={0} flexDirection="row" justifyContent="space-between">
        <Text color={TW_BLUE} bold>
          {title}
        </Text>
        <Text color={TW_DIM}>Ctrl+Enter send · Ctrl+I image · Esc cancel</Text>
      </Box>

      {mode.kind === 'reply' && (
        <Box
          flexShrink={0}
          flexDirection="column"
          marginTop={1}
          borderStyle="single"
          borderColor={TW_SUBTLE}
          paddingX={1}
        >
          <Author author={{ name: '', screenName: mode.inReplyTo.author, id: '' }} />
          <Text color={TW_DIM}>{mode.inReplyTo.text.slice(0, 200)}</Text>
        </Box>
      )}
      {mode.kind === 'quote' && (
        <Box
          flexShrink={0}
          flexDirection="column"
          marginTop={1}
          borderStyle="single"
          borderColor={TW_SUBTLE}
          paddingX={1}
        >
          <Author author={{ name: '', screenName: mode.quoted.author, id: '' }} />
          <Text color={TW_DIM}>{mode.quoted.text.slice(0, 200)}</Text>
        </Box>
      )}

      <Box
        flexGrow={1}
        flexDirection="column"
        marginTop={1}
        borderStyle="single"
        borderColor={over ? 'error' : TW_SUBTLE}
        paddingX={1}
      >
        <TweetText text={text || '(start typing…)'} />
        <Text>{''}</Text>
      </Box>

      <Box flexShrink={0} marginTop={1} flexDirection="row" gap={2}>
        <Text color={over ? 'error' : remaining < 20 ? 'warning' : TW_DIM}>
          {text.length} / {MAX_CHARS}
        </Text>
        <Text color={TW_DIM}>
          {images.length}/{MAX_IMAGES} images
        </Text>
        {images.length > 0 && (
          <Text color={TW_BLUE}>
            {images.map((_p, i) => `[${i + 1}]`).join(' ')}
          </Text>
        )}
      </Box>

      {imgPromptOpen && (
        <Box marginTop={1} flexDirection="row" borderStyle="single" borderColor={TW_BLUE} paddingX={1}>
          <Text color={TW_BLUE}>Image path: </Text>
          <Text>{imgPrompt}</Text>
          <Text color={TW_BLUE}>▍</Text>
          <Text color={TW_DIM}> (Enter to add · Esc to cancel)</Text>
        </Box>
      )}
      {images.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          {images.map((p, i) => (
            <Text key={p + i} color={TW_DIM}>
              • {p}
            </Text>
          ))}
        </Box>
      )}
      {error && (
        <Box marginTop={1}>
          <Text color="error">{error}</Text>
        </Box>
      )}
      {submitting && (
        <Box marginTop={1}>
          <Text color={TW_BLUE}>Posting…</Text>
        </Box>
      )}
    </Box>
  )
}

// Keep `push` imported for downstream refactors (currently unused).
void push
