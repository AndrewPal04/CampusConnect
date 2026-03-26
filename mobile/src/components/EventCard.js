import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, CATEGORY_COLORS } from '../theme';

export default function EventCard({ event, onPress, compact }) {
  const cat = CATEGORY_COLORS[event.category] || CATEGORY_COLORS.Default;
  const pct = Math.round((event.rsvpCount / event.capacity) * 100);

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compact, { borderLeftColor: cat.border }]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {event.aiRecommended && (
          <Text style={styles.aiTag}>✨ AI Pick</Text>
        )}
        <Text style={styles.compactTitle} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={styles.compactOrg} numberOfLines={1}>
          {event.org}
        </Text>
        <Text style={styles.compactMeta}>📅 {event.date}</Text>
        <Text style={styles.compactMeta}>📍 {event.location}</Text>
        <View style={styles.compactFooter}>
          <View style={[styles.catBadge, { backgroundColor: cat.bg, borderColor: cat.border }]}>
            <Text style={[styles.catText, { color: cat.text }]}>{event.category}</Text>
          </View>
          <Text style={[styles.freeTag, { color: event.isFree ? COLORS.greenMid : COLORS.amber }]}>
            {event.isFree ? 'FREE' : event.price}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.cardHeader, { backgroundColor: cat.header }]}>
        <View style={styles.headerTop}>
          <View style={[styles.catBadge, { backgroundColor: COLORS.amber, borderColor: COLORS.amber }]}>
            <Text style={[styles.catText, { color: COLORS.ink }]}>
              {event.category.toUpperCase()}
            </Text>
          </View>
          {event.aiRecommended && (
            <View style={styles.aiTagDark}>
              <Text style={styles.aiTagDarkText}>✨ AI Pick</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={styles.cardOrg} numberOfLines={1}>
          {event.org}
        </Text>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.metaLine}>📅 {event.date}  ·  {event.time}</Text>
        <Text style={styles.metaLine}>📍 {event.location}</Text>

        <View style={styles.progressWrap}>
          <View style={styles.progressBg}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(pct, 100)}%`,
                  backgroundColor: pct > 80 ? COLORS.red : COLORS.greenMid,
                },
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>
            {event.rsvpCount.toLocaleString()} / {event.capacity.toLocaleString()} attending
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <Text style={[styles.freeTag, { color: event.isFree ? COLORS.greenMid : COLORS.amber }]}>
            ● {event.isFree ? 'FREE' : event.price}
          </Text>
          <Text style={styles.detailsLink}>Details →</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Full card
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  cardHeader: { padding: 16, paddingBottom: 18 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  catBadge: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  catText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  aiTagDark: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  aiTagDarkText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  cardTitle: {
    color: COLORS.cream,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
    marginBottom: 4,
  },
  cardOrg: { color: 'rgba(255,255,255,0.65)', fontSize: 12 },
  cardBody: { padding: 14 },
  metaLine: { fontSize: 13, color: '#555', marginBottom: 5 },
  progressWrap: { marginTop: 8, marginBottom: 4 },
  progressBg: {
    height: 5,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  progressLabel: { fontSize: 11, color: COLORS.gray, marginTop: 4 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  freeTag: { fontSize: 12, fontWeight: '700' },
  detailsLink: { fontSize: 13, color: COLORS.blueMid, fontWeight: '700' },

  // Compact card
  compact: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    minHeight: 170,
  },
  aiTag: { fontSize: 11, color: COLORS.purpleMid, fontWeight: '700', marginBottom: 4 },
  compactTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.ink,
    lineHeight: 19,
    marginBottom: 4,
  },
  compactOrg: { fontSize: 11, color: COLORS.gray, marginBottom: 6 },
  compactMeta: { fontSize: 11, color: '#555', marginBottom: 2 },
  compactFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
});
