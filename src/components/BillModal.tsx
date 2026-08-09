import { CADENCES, CATEGORIES } from '@/data/expenses'
import { useTracker } from '@/state/TrackerContext'
import { Dialog } from '@/components/Dialog'

export function BillModal() {
  const {
    billModal,
    billDraft,
    setBillField,
    saveBill,
    closeBillModal,
    removeBill,
  } = useTracker()
  if (!billModal) return null
  const isNew = billModal === 'new'

  return (
    <Dialog
      title={isNew ? 'Add a bill' : 'Edit bill'}
      onClose={closeBillModal}
      actions={
        <>
          {!isNew && (
            <button
              onClick={() => {
                removeBill(billModal)
                closeBillModal()
              }}
              className="btn btn-ghost mr-auto text-xs"
            >
              Delete
            </button>
          )}
          <button onClick={closeBillModal} className="btn btn-secondary">
            Cancel
          </button>
          <button onClick={saveBill} className="btn btn-primary">
            {isNew ? 'Add bill' : 'Save bill'}
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="bill-name">Name</label>
        <input
          id="bill-name"
          type="text"
          className="input"
          value={billDraft.name}
          onChange={(e) => setBillField('name', e.target.value)}
          placeholder="Electricity"
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="field">
          <label htmlFor="bill-amount">Amount</label>
          <input
            id="bill-amount"
            type="number"
            min={0}
            step={0.01}
            className="input"
            value={billDraft.amount}
            onChange={(e) => setBillField('amount', e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="field">
          <label htmlFor="bill-day">Due day</label>
          <input
            id="bill-day"
            type="number"
            min={1}
            max={31}
            className="input"
            value={billDraft.day}
            onChange={(e) =>
              setBillField(
                'day',
                Math.max(1, Math.min(31, Number(e.target.value) || 1)),
              )
            }
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="bill-cat">Category</label>
        <select
          id="bill-cat"
          className="input"
          value={billDraft.category}
          onChange={(e) => setBillField('category', e.target.value)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Cadence</label>
        <div className="seg mt-2">
          {CADENCES.map((c) => (
            <button
              key={c.id}
              onClick={() => setBillField('cadence', c.id)}
              className="seg-opt"
              aria-pressed={billDraft.cadence === c.id}
              style={{
                background:
                  billDraft.cadence === c.id
                    ? 'var(--color-accent-800)'
                    : 'transparent',
                color:
                  billDraft.cadence === c.id
                    ? 'var(--color-accent-300)'
                    : 'var(--color-neutral-400)',
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  )
}
