import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { useGame } from '../../src/game/state';
import { T } from '../../src/ui/theme';
import { TopBar, SectionHeader } from '../../src/ui/components';
import { defaultTiers, genServiceName, TIER_PERIOD_LABEL, effectiveMonthlyPrice } from '../../src/game/data';
import { SubscriptionTier, TierPeriod } from '../../src/game/types';

const PERIOD_OPTS: { key: TierPeriod; label: string }[] = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'quarterly', label: '3-Month' },
  { key: 'biannual', label: '6-Month' },
  { key: 'yearly', label: 'Yearly' },
];

function notify(title: string, msg: string) {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
}

export default function StreamingLaunch() {
  const router = useRouter();
  const { state, launchStreamingService } = useGame();
  const [name, setName] = useState(state ? genServiceName(state.player.name) : '');
  const [tiers, setTiers] = useState<SubscriptionTier[]>(defaultTiers());

  if (!state) return null;

  const cash = state.player.cash;
  const cost = 0.2;

  const updateTier = (idx: number, patch: Partial<SubscriptionTier>) => {
    setTiers(t => t.map((x, i) => i === idx ? { ...x, ...patch } : x));
  };
  const removeTier = (idx: number) => setTiers(t => t.filter((_, i) => i !== idx));
  const addTier = () => {
    if (tiers.length >= 4) {
      notify('Maximum tiers reached', 'You can have up to 4 tiers per service.');
      return;
    }
    setTiers(t => [...t, {
      id: 'tier_' + Math.random().toString(36).slice(2, 9),
      name: 'New Tier', period: 'monthly', price: 12.99, screens: 2, users: 2, isExclusive: false,
    }]);
  };

  const onLaunch = () => {
    if (!name.trim()) { notify('Name required', 'Give your streaming service a name.'); return; }
    if (tiers.length === 0) { notify('Tiers required', 'Add at least one subscription tier.'); return; }
    if (cash < cost) { notify('Not enough cash', `Launch costs $${(cost * 1000).toFixed(0)}M. You have $${(cash * 1000).toFixed(0)}M.`); return; }
    const r = launchStreamingService({ name: name.trim(), tiers });
    if (r.error) { notify('Cannot launch', r.error); return; }
    router.replace('/streaming');
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <TopBar title="Launch Streaming Service" onBack={() => router.back()} onHome={() => router.replace('/dashboard')} />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <SectionHeader title="Service Identity" />
        <View style={s.section}>
          <Text style={s.label}>Service Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Lunar+, MoonStream"
            placeholderTextColor={T.textMute}
            style={s.input}
            testID="svc-name-input"
          />
          <Text style={s.hint}>Cash on hand: ${(cash * 1000).toFixed(0)}M · Launch cost: ${(cost * 1000).toFixed(0)}M</Text>
        </View>

        <SectionHeader title={`Subscription Tiers · ${tiers.length}/4`} />
        {tiers.map((t, idx) => (
          <View key={t.id} style={s.tierCard} testID={`tier-${idx}`}>
            <View style={s.tierHeader}>
              <TextInput
                value={t.name}
                onChangeText={v => updateTier(idx, { name: v })}
                style={[s.input, { flex: 1, fontWeight: '900', fontSize: 16 }]}
                placeholder="Tier name"
                placeholderTextColor={T.textMute}
                testID={`tier-name-${idx}`}
              />
              {tiers.length > 1 && (
                <TouchableOpacity onPress={() => removeTier(idx)} style={s.deleteBtn} testID={`tier-delete-${idx}`}>
                  <MaterialCommunityIcons name="close-circle" size={26} color={T.orange} />
                </TouchableOpacity>
              )}
            </View>

            <Text style={s.tierLabel}>Period</Text>
            <View style={s.periodRow}>
              {PERIOD_OPTS.map(p => (
                <TouchableOpacity
                  key={p.key}
                  onPress={() => updateTier(idx, { period: p.key })}
                  style={[s.periodChip, t.period === p.key && { backgroundColor: T.cyan, borderColor: T.cyan }]}
                  testID={`tier-${idx}-period-${p.key}`}
                >
                  <Text style={[s.periodTxt, t.period === p.key && { color: T.cardDark }]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.numRow}>
              <NumField label="Price ($)" value={t.price} step={1} min={1} max={500}
                onChange={v => updateTier(idx, { price: +v.toFixed(2) })} testID={`tier-${idx}-price`} />
              <NumField label="Screens" value={t.screens} step={1} min={1} max={10}
                onChange={v => updateTier(idx, { screens: Math.round(v) })} testID={`tier-${idx}-screens`} />
              <NumField label="Profiles" value={t.users} step={1} min={1} max={10}
                onChange={v => updateTier(idx, { users: Math.round(v) })} testID={`tier-${idx}-users`} />
            </View>
            <Text style={s.tierHint}>≈ ${effectiveMonthlyPrice(t).toFixed(2)}/mo equivalent</Text>
          </View>
        ))}

        <TouchableOpacity style={s.addTier} onPress={addTier} testID="add-tier">
          <MaterialCommunityIcons name="plus-circle" size={20} color={T.green} />
          <Text style={s.addTierTxt}>Add Tier</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.launchBtn} onPress={onLaunch} testID="confirm-launch">
          <MaterialCommunityIcons name="rocket-launch" size={22} color={T.cardDark} />
          <Text style={s.launchTxt}>Launch · -${(cost * 1000).toFixed(0)}M</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function NumField({ label, value, step, min, max, onChange, testID }: { label: string; value: number; step: number; min: number; max: number; onChange: (v: number) => void; testID?: string }) {
  return (
    <View style={s.numField}>
      <Text style={s.numLabel}>{label}</Text>
      <View style={s.numCtl}>
        <TouchableOpacity onPress={() => onChange(Math.max(min, value - step))} style={s.numBtn} testID={`${testID}-dec`}>
          <Text style={s.numBtnTxt}>−</Text>
        </TouchableOpacity>
        <Text style={s.numVal} testID={`${testID}-val`}>{label.includes('Price') ? value.toFixed(2) : value.toString()}</Text>
        <TouchableOpacity onPress={() => onChange(Math.min(max, value + step))} style={s.numBtn} testID={`${testID}-inc`}>
          <Text style={s.numBtnTxt}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  section: { padding: 12 },
  label: { color: T.textDim, fontSize: 12, fontWeight: '800', marginBottom: 4 },
  input: { backgroundColor: T.cardDark, borderWidth: 2, borderColor: T.border, color: T.text, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, fontSize: 14 },
  hint: { color: T.textMute, fontSize: 11, marginTop: 6, fontWeight: '700' },
  tierCard: { backgroundColor: T.cardDark, margin: 8, padding: 10, borderRadius: 10, borderWidth: 2, borderColor: T.border },
  tierHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  deleteBtn: { padding: 4 },
  tierLabel: { color: T.textDim, fontSize: 11, fontWeight: '800', marginTop: 6, marginBottom: 4 },
  periodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  periodChip: { backgroundColor: T.card, borderWidth: 2, borderColor: T.border, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  periodTxt: { color: T.text, fontWeight: '800', fontSize: 11 },
  numRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  numField: { flex: 1 },
  numLabel: { color: T.textDim, fontSize: 10, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  numCtl: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.card, borderRadius: 8, borderWidth: 1, borderColor: T.border, justifyContent: 'space-between', paddingHorizontal: 4 },
  numBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  numBtnTxt: { color: T.cyan, fontSize: 18, fontWeight: '900' },
  numVal: { color: T.text, fontWeight: '900', fontSize: 14 },
  tierHint: { color: T.textMute, fontSize: 10, marginTop: 4, textAlign: 'center', fontWeight: '700' },
  exclChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, marginTop: 8, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1.5, borderColor: T.border },
  exclTxt: { color: T.text, fontSize: 11, fontWeight: '700' },
  addTier: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, marginHorizontal: 8, borderRadius: 10, borderWidth: 2, borderColor: T.green, borderStyle: 'dashed' as any, marginTop: 4 },
  addTierTxt: { color: T.green, fontWeight: '900', fontSize: 14 },
  launchBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: T.green, padding: 14, borderRadius: 10, marginHorizontal: 8, marginTop: 16, gap: 8, borderWidth: 2, borderColor: T.border },
  launchTxt: { color: T.cardDark, fontWeight: '900', fontSize: 16 },
});
