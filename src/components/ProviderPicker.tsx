/**
 * ProviderPicker — small dropdown for selecting which LLM provider to
 * use when the user clicks Run. Sits in the chat panel's input bar.
 *
 * Selection persists per browser via localStorage so a user's preferred
 * provider survives page reloads. When the user picks a key-required
 * provider AND no matching key is in localStorage, fires `onNeedsKey`
 * — consumer typically opens the SettingsPanel inline so the user can
 * paste a key without hunting for the gear icon.
 */

import { PROVIDER_OPTIONS, type ProviderKind } from '../runner/buildProvider';
import { providerNeedsKey } from '../utils/apiKeys';

interface Props {
  value: ProviderKind;
  onChange: (kind: ProviderKind) => void;
  /**
   * Fires when the user picks a key-required provider AND no key is
   * saved for that vendor. Consumer typically opens the SettingsPanel
   * so the user can paste a key inline without hunting for the gear.
   */
  onNeedsKey?: (kind: ProviderKind) => void;
}

export function ProviderPicker({ value, onChange, onNeedsKey }: Props) {
  return (
    <select
      className="provider-picker"
      value={value}
      onChange={(e) => {
        const next = e.target.value as ProviderKind;
        onChange(next);
        // Drawer-on-pick: if the user selected a real provider with no
        // saved key, prompt for one immediately. Skip when a key is
        // already present (no friction on subsequent reloads).
        if (next !== value && onNeedsKey && providerNeedsKey(next)) {
          onNeedsKey(next);
        }
      }}
      title="LLM provider — Mock runs scripted responses; real providers need an API key"
      aria-label="LLM provider"
    >
      {PROVIDER_OPTIONS.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
