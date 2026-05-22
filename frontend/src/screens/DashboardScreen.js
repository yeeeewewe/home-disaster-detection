import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { fetchCurrent } from '../api';
import { COLORS, getStatusStyle } from '../theme';

const POLL_INTERVAL_MS = 5000;

function MetricCard({ label, value, unit }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>
        {value ?? '--'}
        {value != null && unit ? <Text style={styles.metricUnit}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

export default function DashboardScreen() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchCurrent();
      setData(res?.data ?? null);
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

  const status = getStatusStyle(data?.status?.level);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>即時居家環境</Text>
      <Text style={styles.subtitle}>每 {POLL_INTERVAL_MS / 1000} 秒自動更新</Text>

      <View style={[styles.statusCard, { backgroundColor: status.bg }]}>
        <Text style={styles.statusEmoji}>{status.emoji}</Text>
        <Text style={styles.statusLabel}>{status.label}</Text>
        {data?.timestamp ? (
          <Text style={styles.statusTime}>
            最後更新：{new Date(data.timestamp).toLocaleString()}
          </Text>
        ) : (
          <Text style={styles.statusTime}>尚未收到任何感測資料</Text>
        )}
      </View>

      <View style={styles.metricsRow}>
        <MetricCard label="煙霧" value={data?.smoke} unit="ppm" />
        <MetricCard label="溫度" value={data?.temperature} unit="°C" />
        <MetricCard label="濕度" value={data?.humidity} unit="%" />
      </View>

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
  statusTime: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 8 },
  metricsRow: { flexDirection: 'row', gap: 8 },
  metric: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  metricLabel: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 },
  metricValue: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
  metricUnit: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },
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
