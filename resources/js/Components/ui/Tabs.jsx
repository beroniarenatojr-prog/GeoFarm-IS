import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Tabs({ tabs, className = '' }) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id || 0)

  const activeContent = tabs.find(tab => tab.id === activeTab)?.content

  return (
    <div className={`bg-card border rounded-xl overflow-hidden shadow-sm ${className}`}>
      {/* Tab Headers.

          The strip scrolls sideways instead of squeezing. Ten tabs at their
          natural width overflow any laptop screen, and the outer card carries
          overflow-hidden, so the ones past the edge were simply clipped with
          nothing to reach them by.

          min-w-max on the row is what makes it work: without it the flex row
          shrinks to the container and the buttons compress instead of
          overflowing, so there is nothing to scroll. */}
      <div className="border-b bg-muted/30 overflow-x-auto tab-scroll">
        <div className="flex min-w-max -space-x-px">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-all duration-200 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-green-500 bg-green-50 text-green-700 shadow-sm'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Tab Content */}
      <div className="p-6">
        {activeContent}
      </div>
    </div>
  )
}

