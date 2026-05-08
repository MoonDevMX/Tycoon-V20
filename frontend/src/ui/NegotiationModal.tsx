import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { T } from './theme';

// Reusable pull-and-push negotiation modal.
// Props:
//   visible — show/hide
//   subjectTitle — e.g. "Skyforge Saga"
//   subtitle — e.g. "Cyber Studios"
//   currentPriceB — current offer on the table ($B)
//   fairValueB — your AI-estimated fair value ($B) for guidance
//   playerSide — 'buyer' or 'seller'
//   roundsLeft — counters remaining for the player (0..maxRounds)
//   message — optional dialogue from AI ("Counter: $1.20B")
//   history — list of {actor, priceB, week, year}
//   onAccept / onCounter(newPriceB) / onReject / onClose
export function NegotiationModal(props: {
  visible: boolean;
  subjectTitle: string;
  subtitle?: string;
  currentPriceB: number;
  fairValueB?: number;
  playerSide: 'buyer' | 'seller';
  roundsLeft: number;
  message?: string;
  history?: { actor: 'from' | 'to'; priceB: number; week: number; year: number }[];
  onAccept: () => void;
  onCounter: (newPriceB: number) => void;
  onReject: () => void;
  onClose: () => void;
}) {
  const [counter, setCounter] = useState('');
  useEffect(() => { if (props.visible) setCounter(props.currentPriceB.toFixed(2)); }, [props.visible, props.currentPriceB]);
  const valueColor = props.fairValueB ? (
    (props.playerSide === 'buyer'
      ? (props.currentPriceB <= props.fairValueB * 1.05 ? T.green : T.orange)
      : (props.currentPriceB >= props.fairValueB * 0.95 ? T.green : T.orange))
  ) : T.text;
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      <View style={s.bg}>
        <View style={s.card}>
          <View style={{ alignItems: 'center' }}>
            <MaterialCommunityIcons name="handshake" size={32} color={T.cyan} />
            <Text style={s.title} numberOfLines={2}>{props.subjectTitle}</Text>
            {props.subtitle ? <Text style={s.sub}>{props.subtitle}</Text> : null}
          </View>

          <View style={s.priceBox}>
            <Text style={s.priceLbl}>CURRENT OFFER</Text>
            <Text style={[s.priceVal, { color: valueColor }]}>${props.currentPriceB.toFixed(2)} B</Text>
            {props.fairValueB ? (
              <Text style={s.fairLbl}>Estimated fair value: <Text style={{ color: T.cyan, fontWeight: '900' }}>${props.fairValueB.toFixed(2)}B</Text></Text>
            ) : null}
            {props.message ? <Text style={s.msg}>{props.message}</Text> : null}
          </View>

          {props.history && props.history.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
              {props.history.map((h, i) => (
                <View key={i} style={[s.histChip, h.actor === 'from' ? s.histFrom : s.histTo]}>
                  <Text style={s.histLbl}>{h.actor === 'from' ? 'OPENER' : 'COUNTER'}</Text>
                  <Text style={s.histVal}>${h.priceB.toFixed(2)}B</Text>
                </View>
              ))}
            </ScrollView>
          ) : null}

          <Text style={s.fieldLbl}>YOUR COUNTER ($B) — {props.roundsLeft} round{props.roundsLeft === 1 ? '' : 's'} left</Text>
          <TextInput
            value={counter}
            onChangeText={setCounter}
            keyboardType="decimal-pad"
            style={s.inp}
            placeholder="e.g. 1.50"
            placeholderTextColor={T.textMute}
            editable={props.roundsLeft > 0}
            testID="negot-counter-input"
          />

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <TouchableOpacity style={[s.btn, { backgroundColor: T.green, flex: 1 }]} onPress={props.onAccept} testID="negot-accept">
              <MaterialCommunityIcons name="check" size={18} color={T.cardDark} />
              <Text style={[s.btnTxt, { color: T.cardDark }]}>ACCEPT</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btn, { backgroundColor: T.cyan, flex: 1, opacity: props.roundsLeft > 0 ? 1 : 0.4 }]}
              disabled={props.roundsLeft <= 0}
              onPress={() => {
                const v = parseFloat(counter);
                if (!isNaN(v) && v > 0) props.onCounter(v);
              }}
              testID="negot-counter">
              <MaterialCommunityIcons name="swap-horizontal" size={18} color={T.cardDark} />
              <Text style={[s.btnTxt, { color: T.cardDark }]}>COUNTER</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TouchableOpacity style={[s.btn, { backgroundColor: T.red + '99', flex: 1 }]} onPress={props.onReject} testID="negot-reject">
              <MaterialCommunityIcons name="close" size={18} color="#fff" />
              <Text style={[s.btnTxt, { color: '#fff' }]}>REJECT</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, { backgroundColor: T.cardDark, flex: 1, borderWidth: 2, borderColor: T.border }]} onPress={props.onClose}>
              <Text style={[s.btnTxt, { color: T.text }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#4d5058', padding: 18, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 3, borderColor: T.border },
  title: { color: T.text, fontSize: 22, fontWeight: '900', marginTop: 6, textAlign: 'center' },
  sub: { color: T.textDim, fontWeight: '700', fontSize: 13 },
  priceBox: { backgroundColor: T.cardDark, padding: 14, borderRadius: 10, marginTop: 12, alignItems: 'center', borderWidth: 2, borderColor: T.border },
  priceLbl: { color: T.yellow, fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  priceVal: { fontSize: 32, fontWeight: '900' },
  fairLbl: { color: T.textDim, fontSize: 11, marginTop: 2 },
  msg: { color: T.cyan, fontSize: 12, fontStyle: 'italic', marginTop: 6, textAlign: 'center' },
  histChip: { backgroundColor: T.cardDark, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginRight: 6, alignItems: 'center', borderWidth: 1.5 },
  histFrom: { borderColor: T.cyan },
  histTo: { borderColor: T.magenta },
  histLbl: { fontSize: 9, color: T.textMute, fontWeight: '900', letterSpacing: 1 },
  histVal: { color: T.text, fontWeight: '900', fontSize: 13 },
  fieldLbl: { color: T.yellow, marginTop: 12, fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  inp: { backgroundColor: T.cardDark, color: T.text, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 8, borderWidth: 2, borderColor: T.border, marginTop: 6, fontSize: 18, fontWeight: '900' },
  btn: { flexDirection: 'row', paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnTxt: { fontWeight: '900', fontSize: 13 },
});
