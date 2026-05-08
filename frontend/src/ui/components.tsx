import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { T, SHADOW } from './theme';

// Stat box with neon border like Box Office Sim cards
export function NeonStat({ label, value, color, testID }: { label: string; value: string | number; color: string; testID?: string }) {
  return (
    <View style={[s.neonStat, { borderColor: color }]} testID={testID}>
      <Text style={[s.neonLabel, { color }]} numberOfLines={1}>{label}</Text>
      <Text style={s.neonValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// Dark grey rectangular button matching screenshots
export function GreyButton({ label, sublabel, onPress, style, labelStyle, testID, icon, iconColor, disabled }:
  { label?: string; sublabel?: string; onPress?: () => void; style?: ViewStyle; labelStyle?: TextStyle; testID?: string; icon?: any; iconColor?: string; disabled?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      disabled={disabled}
      style={[s.greyBtn, style, disabled && { opacity: 0.5 }]}
      testID={testID}
    >
      {icon ? <MaterialCommunityIcons name={icon} size={22} color={iconColor || T.cyan} style={{ position: 'absolute', top: 8, right: 10 }} /> : null}
      {label ? <Text style={[s.greyBtnLabel, labelStyle]}>{label}</Text> : null}
      {sublabel ? <Text style={s.greyBtnSub}>{sublabel}</Text> : null}
    </TouchableOpacity>
  );
}

// Genre/franchise tile with colored bg + white icon (matches movie thumb style)
export function IconTile({ icon, color, size = 88 }: { icon: string; color: string; size?: number }) {
  return (
    <View style={[s.iconTile, { backgroundColor: color, width: size, height: size, borderRadius: 14, borderWidth: 3, borderColor: T.border }]}>
      <MaterialCommunityIcons name={icon as any} size={size * 0.55} color="#FFFFFF" />
    </View>
  );
}

// Avatar circle for talents — procedural portraits with hair style + facial hair
export function Avatar({ skin, hair, hairStyle, facialHair, size = 60 }: { skin: string; hair: string; hairStyle?: string; facialHair?: string; size?: number }) {
  const headSize = size * 0.55;
  return (
    <View style={[s.avatarOuter, { width: size, height: size, borderRadius: size / 2 }]}>
      {/* head */}
      <View style={{ width: headSize, height: headSize, borderRadius: size, backgroundColor: skin, marginTop: size * 0.18 }} />
      {/* hair: variants */}
      {hairStyle === 'bald' ? null : hairStyle === 'long' ? (
        <View style={{ position: 'absolute', top: size * 0.10, width: size * 0.78, height: size * 0.42, borderTopLeftRadius: size, borderTopRightRadius: size, backgroundColor: hair }} />
      ) : hairStyle === 'curly' ? (
        <View style={{ position: 'absolute', top: size * 0.08, width: size * 0.66, height: size * 0.30, borderRadius: size, backgroundColor: hair }} />
      ) : hairStyle === 'wavy' ? (
        <View style={{ position: 'absolute', top: size * 0.10, width: size * 0.62, height: size * 0.26, borderTopLeftRadius: size, borderTopRightRadius: size, backgroundColor: hair }} />
      ) : hairStyle === 'buzz' ? (
        <View style={{ position: 'absolute', top: size * 0.16, width: size * 0.55, height: size * 0.10, borderTopLeftRadius: size, borderTopRightRadius: size, backgroundColor: hair }} />
      ) : hairStyle === 'bun' ? (
        <>
          <View style={{ position: 'absolute', top: size * 0.04, width: size * 0.20, height: size * 0.20, borderRadius: size, backgroundColor: hair }} />
          <View style={{ position: 'absolute', top: size * 0.12, width: size * 0.6, height: size * 0.22, borderTopLeftRadius: size, borderTopRightRadius: size, backgroundColor: hair }} />
        </>
      ) : (
        <View style={{ position: 'absolute', top: size * 0.12, width: size * 0.6, height: size * 0.22, borderTopLeftRadius: size, borderTopRightRadius: size, backgroundColor: hair }} />
      )}
      {/* facial hair */}
      {facialHair === 'beard' ? (
        <View style={{ position: 'absolute', top: size * 0.55, width: size * 0.5, height: size * 0.18, borderBottomLeftRadius: size, borderBottomRightRadius: size, backgroundColor: hair }} />
      ) : facialHair === 'mustache' ? (
        <View style={{ position: 'absolute', top: size * 0.50, width: size * 0.22, height: size * 0.06, borderRadius: 2, backgroundColor: hair }} />
      ) : facialHair === 'goatee' ? (
        <View style={{ position: 'absolute', top: size * 0.58, width: size * 0.16, height: size * 0.10, borderRadius: 4, backgroundColor: hair }} />
      ) : facialHair === 'stubble' ? (
        <View style={{ position: 'absolute', top: size * 0.52, width: size * 0.45, height: size * 0.14, borderBottomLeftRadius: size, borderBottomRightRadius: size, backgroundColor: hair, opacity: 0.45 }} />
      ) : null}
      {/* shoulders */}
      <View style={{ position: 'absolute', bottom: 0, width: size * 0.92, height: size * 0.32, borderTopLeftRadius: size * 0.5, borderTopRightRadius: size * 0.5, backgroundColor: '#3a3a3a' }} />
    </View>
  );
}

// Section header bar
export function SectionHeader({ title, testID }: { title: string; testID?: string }) {
  return (
    <View style={s.sectionHeader} testID={testID}>
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

// Header bar with back / home / title
export function TopBar({ title, onBack, onHome, right }: { title: string; onBack?: () => void; onHome?: () => void; right?: React.ReactNode }) {
  return (
    <View style={s.topBar}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={s.topBarIcon} testID="topbar-back">
          <MaterialCommunityIcons name="arrow-left-circle-outline" size={36} color="#fff" />
        </TouchableOpacity>
      ) : <View style={s.topBarIcon} />}
      {onHome ? (
        <TouchableOpacity onPress={onHome} style={s.topBarIcon} testID="topbar-home">
          <MaterialCommunityIcons name="home-outline" size={32} color="#fff" />
        </TouchableOpacity>
      ) : <View style={s.topBarIcon} />}
      <Text style={s.topBarTitle} numberOfLines={1}>{title}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>{right}</View>
    </View>
  );
}

const s = StyleSheet.create({
  neonStat: {
    borderWidth: 2.5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: T.cardDark,
    minWidth: 110,
    alignItems: 'center',
  },
  neonLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  neonValue: { color: T.text, fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  greyBtn: {
    backgroundColor: T.card,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: T.border,
    paddingHorizontal: 14,
    paddingVertical: 18,
    justifyContent: 'center',
    ...SHADOW,
  },
  greyBtnLabel: { color: T.text, fontSize: 16, fontWeight: '800' },
  greyBtnSub: { color: T.textDim, fontSize: 13, marginTop: 2 },
  iconTile: { alignItems: 'center', justifyContent: 'center' },
  avatarOuter: {
    backgroundColor: '#bcbcbc',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: T.border,
  },
  sectionHeader: {
    backgroundColor: T.cardDark,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: T.cyan,
  },
  sectionTitle: { color: T.text, fontSize: 18, fontWeight: '800' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: T.cardDark,
    borderBottomWidth: 2,
    borderBottomColor: T.border,
  },
  topBarIcon: { width: 40, alignItems: 'center' },
  topBarTitle: { flex: 1, textAlign: 'center', color: T.text, fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
});

export const styles = s;
