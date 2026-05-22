import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { fetchLogs } from '../api';
import { COLORS, getStatusStyle } from '../theme';

function LogItem({ item }) {
  const status = getStatusStyle(item?.status?.level);
  return (
    <View style={[styles.row, { borderLeftColor: status.bg }]}>
      <View style={styles.rowHeader}>
        <Text style={[styles.badge, { backgroundColor: status.bg }]}>
          {status.emoji} {status.label}
        </Text>
        <Text style={styles.time}>
          {item.timestamp ? new Date(item.timestamp).toLocaleString() : '--'}
        </Text>
      </View>
      <View style={styles.metricsLine}>
        <Text style={styles.metric}>煙霧 {item.smoke ?? '--'}</Text>
        <Text style={styles.metric}>溫度 {item.temperature ?? '--'}°C</Text>
        <Text style={styles.metric}>濕度 {item.humidity ?? '--'}%</Text>
      </View>
      {item.deviceId ? (
        <Text style={styles.device}>裝置：{item.deviceId}</Text>
      ) : null}
    </View>
  );
}

export default function HistoryScreen() {
  const [list, setList] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchLogs(200);
      setList(res?.data ?? []);
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
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={list}
      keyExtractor={(item, idx) => `${item.timestamp}-${idx}`}
      renderItem={({ item }) => <LogItem item={item} />}
      ListHeaderComponent={
        <View>
          <Text style={styles.title}>歷史警報紀錄</Text>
          <Text style={styles.subtitle}>共 {list.length} 筆</Text>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠ {error}</Text>
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        !error ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>🌿</Text>
            <Text style={styles.emptyText}>目前沒有警報紀錄</Text>
          </View>
        ) : null
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 12 },
  row: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  badge: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  time: { fontSize: 12, color: COLORS.textSecondary },
  metricsLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metric: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '600' },
  device: { marginTop: 6, fontSize: 11, color: COLORS.textSecondary },
  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { marginTop: 8, color: COLORS.textSecondary },
  errorBox: {
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    marginBottom: 12,
  },
  errorText: { color: '#991b1b' },
});
