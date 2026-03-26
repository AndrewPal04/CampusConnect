import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import EventCard from '../components/EventCard';
import { COLORS, CATEGORY_COLORS } from '../theme';

const CATEGORIES = ['All', 'Tech', 'Music', 'Sports', 'Social', 'Art', 'Food'];

export default function HomeScreen({ navigation }) {
  const { events, unreadCount } = useApp();
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('All');

  const recommended = useMemo(() => events.filter((e) => e.aiRecommended), [events]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      const matchCat = selectedCat === 'All' || e.category === selectedCat;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        e.title.toLowerCase().includes(q) ||
        e.org.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [events, selectedCat, search]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>CampusConnect</Text>
          <Text style={styles.subtitle}>CAL POLY POMONA</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Notifications')}
          style={styles.notifBtn}
        >
          <Ionicons name="notifications-outline" size={24} color={COLORS.cream} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={17} color={COLORS.gray} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search events, orgs, locations…"
          placeholderTextColor={COLORS.gray}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={17} color={COLORS.gray} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catScroll}
        >
          {CATEGORIES.map((cat) => {
            const active = selectedCat === cat;
            const c = CATEGORY_COLORS[cat] || CATEGORY_COLORS.Default;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setSelectedCat(cat)}
                style={[
                  styles.catChip,
                  active && { backgroundColor: c.header, borderColor: c.header },
                ]}
              >
                <Text style={[styles.catChipText, active && { color: COLORS.cream }]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* AI Recommended */}
        {selectedCat === 'All' && !search && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>✨ Recommended For You</Text>
              <Text style={styles.sectionSub}>AI-powered</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
            >
              {recommended.map((event) => (
                <View key={event.id} style={{ width: 248, marginRight: 12 }}>
                  <EventCard
                    event={event}
                    compact
                    onPress={() =>
                      navigation.navigate('EventDetail', { eventId: event.id })
                    }
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* All events list */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {selectedCat === 'All' ? 'All Events' : `${selectedCat} Events`}
            </Text>
            <Text style={styles.sectionSub}>{filtered.length} events</Text>
          </View>

          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyText}>No events found</Text>
              <Text style={styles.emptySub}>Try a different search or category</Text>
            </View>
          ) : (
            filtered.map((event) => (
              <View key={event.id} style={styles.cardWrap}>
                <EventCard
                  event={event}
                  onPress={() =>
                    navigation.navigate('EventDetail', { eventId: event.id })
                  }
                />
              </View>
            ))
          )}
        </View>
      </ScrollView>
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
  logo: {
    color: COLORS.amber,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#aaa',
    fontSize: 10,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  notifBtn: { position: 'relative', padding: 4 },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: COLORS.red,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.ink,
    paddingVertical: 0,
  },

  catScroll: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  catChip: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: COLORS.white,
  },
  catChipText: { fontSize: 13, fontWeight: '600', color: COLORS.ink },

  section: { marginBottom: 8 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  sectionSub: { fontSize: 12, color: COLORS.gray },

  cardWrap: { paddingHorizontal: 16, marginBottom: 14 },

  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  emptySub: { fontSize: 13, color: COLORS.gray, marginTop: 4 },
});
