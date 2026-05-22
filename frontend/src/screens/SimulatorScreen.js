import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { postSensorUpdate, updateMode } from '../api';
import { COLORS, getStatusStyle } from '../theme';

const SCENARIOS = [
  {
    key: 'safe-home',
    title: '一般居家：安全',
    description: '低煙霧、正常溫濕度，用來展示復歸正常或一般監控狀態。',
    mode: 'home',
    payload: { smoke: 80, temperature: 25, humidity: 55 },
  },
  {
    key: 'kitchen-smoke',
    title: '廚房油煙：警戒',
    description: '模擬炒菜或短暫油煙，煙霧偏高但尚未達到真實火災條件。',
    mode: 'kitchen',
    payload: { smoke: 310, temperature: 36, humidity: 62 },
  },
  {
    key: 'bathroom-steam',
    title: '浴室水氣：干擾/警戒',
    description: '濕度快速升高，展示水氣造成的干擾與警戒判斷。',
    mode: 'bathroom',
    payload: { smoke: 280, temperature: 28, humidity: 96 },
  },
  {
    key: 'fire-smoke-temp',
    title: '火災：煙霧與高溫',
    description: '煙霧與溫度同步升高，Sensor Fusion 會提高火災可信度。',
    mode: 'home',
    payload: { smoke: 720, temperature: 73, humidity: 42 },
  },
  {
    key: 'away-sensitive',
    title: '無人在家：敏感監控',
    description: '外出模式下門檻較敏感，較低風險也能提早提醒。',
    mode: 'away',
    payload: { smoke: 240, temperature: 38, humidity: 58 },
  },
  {
    key: 'recover-normal',
    title: '復歸正常',
    description: '異常後送出安全數值，展示 recovered 事件與畫面轉綠。',
    mode: 'home',
    payload: { smoke: 70, temperature: 24, humidity: 50 },
  },
];

const DEMO_SEQUENCE = [
  'safe-home',
  'kitchen-smoke',
  'bathroom-steam',
  'fire-smoke-temp',
  'recover-normal',
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ScenarioCard({ scenario, running, onRun }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{scenario.title}</Text>
        <Text style={styles.modeBadge}>{scenario.mode}</Text>
      </View>
      <Text style={styles.description}>{scenario.description}</Text>
      <View style={styles.valuesRow}>
        <Text style={styles.value}>煙霧 {scenario.payload.smoke}</Text>
        <Text style={styles.value}>溫度 {scenario.payload.temperature}°C</Text>
        <Text style={styles.value}>濕度 {scenario.payload.humidity}%</Text>
      </View>
      <Pressable
        disabled={running}
        onPress={() => onRun(scenario)}
        style={[styles.button, running ? styles.buttonDisabled : null]}
      >
        <Text style={styles.buttonText}>送出這組模擬</Text>
      </Pressable>
    </View>
  );
}

export default function SimulatorScreen() {
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);

  const runScenario = async (scenario) => {
    setRunning(true);
    setError(null);
    try {
      await updateMode(scenario.mode);
      const res = await postSensorUpdate({
        deviceId: `sim-${scenario.key}`,
        mode: scenario.mode,
        ...scenario.payload,
      });
      setLastResult({ scenario, record: res.record });
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const confirmRunScenario = (scenario) => {
    Alert.alert(
      '送出模擬資料',
      `確定要執行「${scenario.title}」嗎？\n\nApp 儀表板將在輪詢後更新，歷史紀錄會新增異常事件。`,
      [
        { text: '取消', style: 'cancel' },
        { text: '執行', onPress: () => runScenario(scenario) },
      ],
    );
  };

  const runDemoSequence = async () => {
    setRunning(true);
    setError(null);
    try {
      for (const key of DEMO_SEQUENCE) {
        const scenario = SCENARIOS.find((item) => item.key === key);
        await updateMode(scenario.mode);
        const res = await postSensorUpdate({
          deviceId: `sim-sequence-${scenario.key}`,
          mode: scenario.mode,
          ...scenario.payload,
        });
        setLastResult({ scenario, record: res.record });
        await sleep(1200);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const confirmDemoSequence = () => {
    Alert.alert(
      '一鍵展示流程',
      '將依序送出：安全 → 廚房油煙 → 浴室水氣 → 火災 → 復歸正常。確定執行嗎？',
      [
        { text: '取消', style: 'cancel' },
        { text: '開始展示', onPress: runDemoSequence },
      ],
    );
  };

  const resultStatus = getStatusStyle(lastResult?.record?.status?.level);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>一鍵模擬測試</Text>
      <Text style={styles.subtitle}>
        不需要 ESP32，也能快速展示不同情境下的 Sensor Fusion 判斷。
      </Text>

      <Pressable
        disabled={running}
        onPress={confirmDemoSequence}
        style={[styles.demoButton, running ? styles.buttonDisabled : null]}
      >
        {running ? <ActivityIndicator color="#fff" /> : <Text style={styles.demoButtonText}>▶ 一鍵連續展示</Text>}
      </Pressable>

      {lastResult ? (
        <View style={[styles.resultBox, { borderLeftColor: resultStatus.bg }]}> 
          <Text style={styles.resultTitle}>最近送出：{lastResult.scenario.title}</Text>
          <Text style={styles.resultText}>
            {resultStatus.emoji} {lastResult.record.status.label} · 風險 {lastResult.record.status.riskScore}
          </Text>
          <Text style={styles.resultReason}>
            {(lastResult.record.status.fusion?.reasons || []).join('、')}
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠ {error}</Text>
        </View>
      ) : null}

      {SCENARIOS.map((scenario) => (
        <ScenarioCard
          key={scenario.key}
          scenario={scenario}
          running={running}
          onRun={confirmRunScenario}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, marginBottom: 16 },
  demoButton: {
    backgroundColor: '#0ea5e9',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 14,
  },
  demoButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  buttonDisabled: { opacity: 0.55 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  modeBadge: {
    fontSize: 11,
    color: '#0369a1',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  description: { marginTop: 8, fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
  valuesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  value: {
    fontSize: 12,
    color: COLORS.textPrimary,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  button: {
    marginTop: 12,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  resultBox: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 5,
    borderColor: COLORS.cardBorder,
    padding: 12,
    marginBottom: 12,
  },
  resultTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary },
  resultText: { marginTop: 6, fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  resultReason: { marginTop: 4, fontSize: 12, color: COLORS.textSecondary },
  errorBox: {
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    marginBottom: 12,
  },
  errorText: { color: '#991b1b' },
});
