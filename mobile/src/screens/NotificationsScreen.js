import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COLORS } from '../theme';

export default function NotificationsScreen() {
  const { notifications, markAllRead, unreadCount } = useApp();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.logo}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead}>
            <Text style={styles.markRead}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {unreadCount > 0 && (
        <View style={styles.unreadBar}>
          <Ionicons name="ellipse" size={8} color={COLORS.amber} />
          <Text style={styles.unreadText}>
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.notif, !item.read && styles.notifUnread]}>
            <View style={[styles.notifIconBox, { backgroundColor: item.read ? '#eee' : COLORS.blue }]}>
              <Text style={{ fontSize: 18 }}>{item.icon}</Text>
            </View>
            <View style={styles.notifBody}>
              <Text style={[styles.notifTitle, !item.read && styles.bold]}>
                {item.title}
              </Text>
              <Text style={styles.notifDesc} numberOfLines={2}>
                {item.body}
              </Text>
              <Text style={styles.notifTime}>{item.time}</Text>
            </View>
            {!item.read && <View style={styles.unreadDot} />}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    backgroundColor: COLORS.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.amber,
  },
  logo: { color: COLORS.amber, fontSize: 18, fontWeight: '800' },
  markRead: { color: '#aaa', fontSize: 13 },

  unreadBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: COLORS.amberLight,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  unreadText: { fontSize: 12, color: '#7a4400', fontWeight: '600' },

  notif: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  notifUnread: { backgroundColor: '#fafcff', borderColor: '#c8dbff' },
  notifIconBox: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notifBody: { flex: 1 },
  notifTitle: { fontSize: 13, fontWeight: '600', color: COLORS.ink },
  bold: { fontWeight: '800' },
  notifDesc: { fontSize: 12, color: COLORS.gray, marginTop: 2, lineHeight: 17 },
  notifTime: { fontSize: 11, color: '#bbb', marginTop: 4 },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: COLORS.blueMid,
    alignSelf: 'center',
  },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyText: { fontSize: 15, color: COLORS.gray },
});
