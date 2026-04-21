import React from 'react'
import { Box, Text } from '@anthropic/ink'
import { BINDING_HELP } from '../keybindings/bindings.js'
import { TW_BLUE, TW_DIM } from '../theme/twitterTheme.js'

export function HelpOverlay(): React.ReactNode {
  return (
    <Box flexDirection="column" padding={2}>
      <Text bold color={TW_BLUE}>
        Keyboard reference
      </Text>
      <Box marginTop={1} flexDirection="column" gap={1}>
        {BINDING_HELP.map(section => (
          <Box key={section.section} flexDirection="column">
            <Text bold>{section.section}</Text>
            <Box flexDirection="column" paddingLeft={2}>
              {section.rows.map(row => (
                <Box key={row.keys} flexDirection="row">
                  <Box width={28}>
                    <Text color={TW_BLUE}>{row.keys}</Text>
                  </Box>
                  <Text color={TW_DIM}>{row.action}</Text>
                </Box>
              ))}
            </Box>
          </Box>
        ))}
      </Box>
      <Box marginTop={2}>
        <Text color={TW_DIM}>Press Esc to close.</Text>
      </Box>
    </Box>
  )
}
