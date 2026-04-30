import React, { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useApp } from '../context/AppContext';
import { createEvent, updateEvent } from '../services/api';
import { CATEGORY_COLORS, COLORS } from '../theme';

const CATEGORY_OPTIONS = [
  { label: 'Tech', value: 'tech' },
  { label: 'Music', value: 'music' },
  { label: 'Sports', value: 'sports' },
  { label: 'Social', value: 'social' },
  { label: 'Art', value: 'art' },
  { label: 'Food', value: 'food' },
  { label: 'Academic', value: 'academic' },
];

function canManageEvents(role) {
  return role === 'org_leader' || role === 'admin';
}

function normalizeCategoryValue(event) {
  const raw = event?.categoryKey || event?.category || '';
  const normalized = String(raw).trim().toLowerCase();
  const exists = CATEGORY_OPTIONS.some((option) => option.value === normalized);
  return exists ? normalized : 'tech';
}

function extractLocationFields(event) {
  const rawLocation = typeof event?.locationName === 'string' ? event.locationName : '';
  const rawVenue = typeof event?.venue === 'string' ? event.venue : '';

  if (rawLocation || rawVenue) {
    return { location: rawLocation, venue: rawVenue };
  }

  if (typeof event?.location === 'string' && event.location.includes(' - ')) {
    const parts = event.location.split(' - ');
    return {
      location: parts[0] || '',
      venue: parts.slice(1).join(' - '),
    };
  }

  return {
    location: typeof event?.location === 'string' ? event.location : '',
    venue: '',
  };
}

function getInitialDate(event) {
  const parsed = new Date(event?.startsAt || event?.date || Date.now());

  if (Number.isNaN(parsed.getTime())) {
    return new Date(Date.now() + 60 * 60 * 1000);
  }

  if (parsed.getTime() <= Date.now()) {
    return new Date(Date.now() + 60 * 60 * 1000);
  }

  return parsed;
}

function getInitialPrice(event) {
  if (event?.priceAmount !== undefined && event?.priceAmount !== null) {
    return String(event.priceAmount);
  }

  if (typeof event?.price === 'string') {
    const normalized = Number(event.price.replace(/[^0-9.]/g, ''));
    if (Number.isFinite(normalized)) {
      return String(normalized);
    }
  }

  return '';
}

function formatDateTime(date) {
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function CreateEventScreen({ navigation, route }) {
  const { currentUser } = useApp();
  const initialEvent = route.params?.event || null;
  const isEditMode = Boolean(initialEvent?.id);
  const role = currentUser?.role;
  const allowed = canManageEvents(role);
  const locationFields = useMemo(() => extractLocationFields(initialEvent), [initialEvent]);

  const [title, setTitle] = useState(initialEvent?.title || '');
  const [category, setCategory] = useState(normalizeCategoryValue(initialEvent));
  const [dateTime, setDateTime] = useState(getInitialDate(initialEvent));
  const [location, setLocation] = useState(locationFields.location);
  const [venue, setVenue] = useState(locationFields.venue);
  const [description, setDescription] = useState(initialEvent?.description || '');
  const [capacity, setCapacity] = useState(
    initialEvent?.capacity ? String(initialEvent.capacity) : ''
  );
  const [isFree, setIsFree] = useState(initialEvent?.isFree ?? true);
  const [price, setPrice] = useState(getInitialPrice(initialEvent));
  const [pickerMode, setPickerMode] = useState(null);
  const [saving, setSaving] = useState(false);

  const selectedCategoryLabel =
    CATEGORY_OPTIONS.find((option) => option.value === category)?.label || 'Tech';
  const selectedCategoryColor =
    CATEGORY_COLORS[selectedCategoryLabel] || CATEGORY_COLORS.Default;

  const handleDateChange = (_, nextValue) => {
    if (!nextValue) {
      if (Platform.OS === 'android') {
        setPickerMode(null);
      }
      return;
    }

    const nextDateTime = new Date(dateTime);
    if (pickerMode === 'date') {
      nextDateTime.setFullYear(
        nextValue.getFullYear(),
        nextValue.getMonth(),
        nextValue.getDate()
      );
    } else {
      nextDateTime.setHours(nextValue.getHours(), nextValue.getMinutes(), 0, 0);
    }

    setDateTime(nextDateTime);

    if (Platform.OS === 'android') {
      setPickerMode(null);
    }
  };

  const handleSubmit = async () => {
    if (!allowed) {
      Alert.alert('Access denied', 'Only organization leaders and admins can manage events.');
      return;
    }

    const trimmedTitle = title.trim();
    const parsedCapacity = Number.parseInt(capacity, 10);
    const parsedPrice = Number.parseFloat(price);

    if (!trimmedTitle) {
      Alert.alert('Missing title', 'Please enter an event title.');
      return;
    }

    if (trimmedTitle.length > 200) {
      Alert.alert('Title too long', 'Title must be 200 characters or fewer.');
      return;
    }

    if (dateTime.getTime() <= Date.now()) {
      Alert.alert('Invalid date', 'Event date and time must be in the future.');
      return;
    }

    if (!Number.isInteger(parsedCapacity) || parsedCapacity <= 0) {
      Alert.alert('Invalid capacity', 'Capacity must be a positive whole number.');
      return;
    }

    if (!isFree && (Number.isNaN(parsedPrice) || price.trim().length === 0)) {
      Alert.alert('Invalid price', 'Please provide a valid price for paid events.');
      return;
    }

    const payload = {
      title: trimmedTitle,
      description: description.trim() || null,
      category,
      date: dateTime.toISOString(),
      endDate: null,
      location: location.trim() || null,
      venue: venue.trim() || null,
      imageUrl: null,
      isFree,
      price: isFree ? 0 : parsedPrice,
      capacity: parsedCapacity,
    };

    setSaving(true);
    try {
      if (isEditMode) {
        await updateEvent(initialEvent.id, payload);
      } else {
        await createEvent(payload);
      }

      Alert.alert(
        'Success',
        isEditMode ? 'Event updated successfully.' : 'Event created successfully.'
      );
      navigation.navigate('Home');
    } catch (error) {
      Alert.alert(
        'Save failed',
        error?.message || 'Could not save this event right now. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (!allowed) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.cream} />
          </TouchableOpacity>
          <Text style={styles.barTitle}>Create Event</Text>
          <View style={{ width: 30 }} />
        </View>
        <View style={styles.lockedWrap}>
          <Text style={styles.lockedTitle}>Access denied</Text>
          <Text style={styles.lockedText}>
            Only organization leaders and admins can access this screen.
          </Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.cream} />
        </TouchableOpacity>
        <Text style={styles.barTitle}>
          {isEditMode ? 'Edit Event' : 'Create Event'}
        </Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Event title"
            placeholderTextColor={COLORS.gray}
            maxLength={200}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catRow}
          >
            {CATEGORY_OPTIONS.map((option) => {
              const active = category === option.value;
              const catColor = CATEGORY_COLORS[option.label] || CATEGORY_COLORS.Default;
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setCategory(option.value)}
                  style={[
                    styles.catChip,
                    active && {
                      backgroundColor: catColor.header,
                      borderColor: catColor.header,
                    },
                  ]}
                >
                  <Text style={[styles.catChipText, active && { color: COLORS.cream }]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View
            style={[
              styles.categoryPreview,
              { backgroundColor: selectedCategoryColor.bg, borderColor: selectedCategoryColor.border },
            ]}
          >
            <Text style={[styles.categoryPreviewText, { color: selectedCategoryColor.text }]}>
              Selected: {selectedCategoryLabel}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Date & Time</Text>
          <View style={styles.dateRow}>
            <TouchableOpacity
              style={styles.dateBtn}
              onPress={() =>
                setPickerMode((prev) => (prev === 'date' ? null : 'date'))
              }
              activeOpacity={0.85}
            >
              <Ionicons name="calendar-outline" size={17} color={COLORS.ink} />
              <Text style={styles.dateBtnText}>Pick Date</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dateBtn}
              onPress={() =>
                setPickerMode((prev) => (prev === 'time' ? null : 'time'))
              }
              activeOpacity={0.85}
            >
              <Ionicons name="time-outline" size={17} color={COLORS.ink} />
              <Text style={styles.dateBtnText}>Pick Time</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.dateValue}>{formatDateTime(dateTime)}</Text>
          {pickerMode && (
            <>
              <DateTimePicker
                value={dateTime}
                mode={pickerMode}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                onChange={handleDateChange}
              />
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={styles.pickerDoneBtn}
                  onPress={() => setPickerMode(null)}
                >
                  <Text style={styles.pickerDoneText}>Done</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder="Building, lawn, or area"
            placeholderTextColor={COLORS.gray}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Venue</Text>
          <TextInput
            style={styles.input}
            value={venue}
            onChangeText={setVenue}
            placeholder="Room, stage, or specific spot"
            placeholderTextColor={COLORS.gray}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the event"
            placeholderTextColor={COLORS.gray}
            multiline
            textAlignVertical="top"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Capacity</Text>
          <TextInput
            style={styles.input}
            value={capacity}
            onChangeText={setCapacity}
            placeholder="e.g. 120"
            placeholderTextColor={COLORS.gray}
            keyboardType="number-pad"
          />
        </View>

        <View style={[styles.section, styles.toggleRow]}>
          <Text style={styles.label}>Is Free</Text>
          <Switch
            value={isFree}
            onValueChange={setIsFree}
            thumbColor={isFree ? COLORS.amber : COLORS.gray}
            trackColor={{ false: '#c8c3ba', true: '#f1d28f' }}
          />
        </View>

        {!isFree && (
          <View style={styles.section}>
            <Text style={styles.label}>Price</Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              placeholder="e.g. 5.00"
              placeholderTextColor={COLORS.gray}
              keyboardType="decimal-pad"
            />
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryBtn, saving && styles.primaryBtnDisabled]}
            onPress={handleSubmit}
            disabled={saving}
          >
            <Text style={styles.primaryBtnText}>
              {saving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Event'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  topBar: {
    backgroundColor: COLORS.ink,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.amber,
  },
  backBtn: {
    padding: 4,
  },
  barTitle: {
    flex: 1,
    color: COLORS.cream,
    fontSize: 15,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 30,
    gap: 14,
  },
  section: {
    gap: 8,
  },
  label: {
    color: COLORS.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.ink,
  },
  textArea: {
    minHeight: 100,
  },
  catRow: {
    gap: 8,
    paddingVertical: 2,
  },
  catChip: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: COLORS.white,
  },
  catChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.ink,
  },
  categoryPreview: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  categoryPreviewText: {
    fontWeight: '700',
    fontSize: 12,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    borderRadius: 11,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  dateBtnText: {
    color: COLORS.ink,
    fontWeight: '700',
    fontSize: 13,
  },
  dateValue: {
    color: COLORS.blue,
    fontSize: 13,
    fontWeight: '700',
  },
  pickerDoneBtn: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.ink,
  },
  pickerDoneText: {
    color: COLORS.cream,
    fontSize: 12,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actions: {
    marginTop: 6,
    gap: 10,
  },
  primaryBtn: {
    backgroundColor: COLORS.amber,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 13,
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: COLORS.ink,
    fontWeight: '800',
    fontSize: 14,
  },
  secondaryBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.ink,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: COLORS.cream,
  },
  secondaryBtnText: {
    color: COLORS.ink,
    fontWeight: '700',
    fontSize: 14,
  },
  lockedWrap: {
    paddingHorizontal: 20,
    paddingTop: 38,
    alignItems: 'center',
  },
  lockedTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.ink,
  },
  lockedText: {
    marginTop: 8,
    fontSize: 13,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: 16,
  },
  cancelBtn: {
    backgroundColor: COLORS.amber,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelBtnText: {
    color: COLORS.ink,
    fontWeight: '700',
  },
});
