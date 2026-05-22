import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { fetchCurrent, fetchMode, updateMode } from '../api';
import { COLORS, getStatusStyle } from '../theme';

const POLL_INTERVAL_MS = 5000;

function MetricCard({ label, value, unit, sub }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>
        {value ?? '--'}
        {value != null && unit ? <Text style={styles.metricUnit}> {unit}</Text> : null}
      </Text>
      {sub ? <Text style={styles.metricSub}>{sub}</Text> : null}
    </View>
  );
}

function ModeChip({ mode, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.modeChip, active ? styles.modeChipActive : null]}
    >
      <Text style={[styles.modeChipText, active ? styles.modeChipTextActive : null]}>
        {mode.label}
      </Text>
    </Pressable>
  );
}

export default function DashboardScreen() {
  const [data, setData] = useState(null);
  const [modeInfo, setModeInfo] = useState({ current: null, modes: [] });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const [currentRes, modeRes] = await Promise.all([fetchCurrent(), fetchMode()]);
      setData(currentRes?.data ?? null);
      setModeInfo({
        current: modeRes?.current ?? null,
        modes: modeRes?.modes ?? [],
      });
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleModeChange = async (mode) => {
    try {
      const res = await updateMode(mode);
      setModeInfo((prev) => ({ ...prev, current: res.current }));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const status = getStatusStyle(data?.status?.level);
  const fusion = data?.status?.fusion;
  const riskScore = data?.status?.riskScore;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>即時居家環境</Text>
      <Text style={styles.subtitle}>每 {POLL_INTERVAL_MS / 1000} 秒自動更新 · Sensor Fusion</Text>

      <View style={styles.modePanel}>
        <Text style={styles.sectionTitle}>情境模式</Text>
        <View style={styles.modeRow}>
          {modeInfo.modes.map((mode) => (
            <ModeChip
              key={mode.key}
              mode={mode}
              active={modeInfo.current?.key === mode.key}
              onPress={() => handleModeChange(mode.key)}
            />
          ))}
        </View>
      </View>

      <View style={[styles.statusCard, { backgroundColor: status.bg }]}> 
        <Text style={styles.statusEmoji}>{status.emoji}</Text>
        <Text style={styles.statusLabel}>{data?.status?.label || status.label}</Text>
        <Text style={styles.riskText}>風險分數：{riskScore ?? '--'} / 100</Text>
        {data?.timestamp ? (
          <Text style={styles.statusTime}>
            最後更新：{new Date(data.timestamp).toLocaleString()}
          </Text>
        ) : (
          <Text style={styles.statusTime}>尚未收到任何感測資料</Text>
        )}
      </View>

      <View style={styles.metricsRow}>
        <MetricCard label="煙霧" value={data?.smoke} unit="ppm" sub={fusion ? `風險 ${fusion.smokeRisk}` : ''} />
        <MetricCard label="溫度" value={data?.temperature} unit="°C" sub={fusion ? `風險 ${fusion.temperatureRisk}` : ''} />
        <MetricCard label="濕度" value={data?.humidity} unit="%" sub={fusion ? `風險 ${fusion.humidityRisk}` : ''} />
      </View>

      {fusion ? (
        <View style={styles.fusionCard}>
          <Text style={styles.sectionTitle}>融合判斷</Text>
          <View style={styles.fusionGrid}>
            <Text style={styles.fusionText}>平滑煙霧：{fusion.smoothed?.smoke}</Text>
            <Text style={styles.fusionText}>煙霧趨勢：{fusion.trend?.smoke}</Text>
            <Text style={styles.fusionText}>平滑溫度：{fusion.smoothed?.temperature}°C</Text>
            <Text style={styles.fusionText}>溫度趨勢：{fusion.trend?.temperature}</Text>
            <Text style={styles.fusionText}>平滑濕度：{fusion.smoothed?.humidity}%</Text>
            <Text style={styles.fusionText}>濕度趨勢：{fusion.trend?.humidity}</Text>
          </View>
          <View style={styles.reasonBox}>
            {(fusion.reasons || []).map((reason, idx) => (
              <Text key={`${reason}-${idx}`} style={styles.reasonText}>• {reason}</Text>
            ))}
          </View>
        </View>
      ) : null}

      {data?.deviceId ? (
        <Text style={styles.device}>裝置 ID：{data.deviceId}</Text>
      ) : null}

      {loading && !data ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>正在連線後端…</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>⚠ 連線失敗</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorHint}>
            請確認後端已啟動，並於 app.json 的 extra.apiBaseUrl 設定正確 IP。
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 16 },
  modePanel: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8 },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modeChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
  },
  modeChipActive: { backgroundColor: '#0ea5e9' },
  modeChipText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  modeChipTextActive: { color: '#fff' },
  statusCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  statusEmoji: { fontSize: 48 },
  statusLabel: { fontSize: 28, fontWeight: '800', color: '#fff', marginTop: 8 },
  riskText: { fontSize: 16, fontWeight: '700', color: '#fff', marginTop: 8 },
  statusTime: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 8 },
  metricsRow: { flexDirection: 'row', gap: 8 },
  metric: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  metricLabel: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 },
  metricValue: { fontSize: 21, fontWeight: '700', color: COLORS.textPrimary },
  metricUnit: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },
  metricSub: { marginTop: 4, fontSize: 11, color: COLORS.textSecondary },
  fusionCard: {
    marginTop: 12,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  fusionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fusionText: { width: '48%', fontSize: 12, color: COLORS.textSecondary },
  reasonBox: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  reasonText: { fontSize: 13, color: COLORS.textPrimary, marginBottom: 4 },
  device: { marginTop: 12, fontSize: 12, color: COLORS.textSecondary },
  loadingBox: { marginTop: 24, alignItems: 'center' },
  loadingText: { marginTop: 8, color: COLORS.textSecondary },
  errorBox: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorTitle: { fontSize: 15, fontWeight: '700', color: '#991b1b' },
  errorText: { marginTop: 4, color: '#991b1b' },
  errorHint: { marginTop: 8, fontSize: 12, color: '#7f1d1d' },
});
