import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Tabs({ tabs, className = '' }) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id || 0)

  const activeContent = tabs.find(tab => tab.id === activeTab)?.content

  return (
    <div className={`bg-card border rounded-xl overflow-hidden shadow-sm ${className}`}>
      {/* Tab Headers */}
      <div className="border-b bg-muted/30">
        <div className="flex -space-x-px">
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

