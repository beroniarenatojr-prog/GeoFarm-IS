'use client'

import { Toaster as Sonner } from 'react-hot-toast'

const Toaster = () => (
  <Sonner 
    position="top-right"
    toastOptions={{
      style: {
        background: 'hsl(var(--background))',
        color: 'hsl(var(--foreground))',
        border: 'hsl(var(--border))',
      },
    }}
  />
)

export { Toaster }

