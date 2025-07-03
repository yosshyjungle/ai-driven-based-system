import RealtimeTextCompare from '@/components/RealtimeTextCompare'
import Navbar from '@/components/Navbar'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <RealtimeTextCompare />
    </div>
  )
}
