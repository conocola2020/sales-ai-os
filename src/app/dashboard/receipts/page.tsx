import ReceiptPage from '@/components/receipts/ReceiptPage'

export const dynamic = 'force-dynamic'

export default function ReceiptsPage() {
  return (
    <div className="h-full overflow-y-auto">
      <ReceiptPage />
    </div>
  )
}
