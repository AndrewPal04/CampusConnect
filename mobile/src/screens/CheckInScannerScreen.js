import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { useApp } from '../context/AppContext';
import { checkInAttendee } from '../services/api';
import { COLORS } from '../theme';

const SCAN_STATE = {
  IDLE: 'idle',
  SCANNING: 'scanning',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  ERROR: 'error',
};

const RESET_DELAY_MS = 2000;

function canManageCheckIn(role) {
  return role === 'org_leader' || role === 'admin';
}

export default function CheckInScannerScreen({ navigation, route }) {
  const { currentUser } = useApp();
  const event = route.params?.event || null;
  const eventTitle = event?.title || 'Event Check-In';
  const allowed = canManageCheckIn(currentUser?.role);

  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState(SCAN_STATE.IDLE);
  const [banner, setBanner] = useState(null);
  const resetTimerRef = useRef(null);

  useEffect(() => {
    requestPermission().catch(() => {});
  }, [requestPermission]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!allowed || !permission?.granted) {
      return;
    }

    if (scanState === SCAN_STATE.IDLE) {
      setScanState(SCAN_STATE.SCANNING);
    }
  }, [allowed, permission?.granted, scanState]);

  const scheduleReset = () => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }

    resetTimerRef.current = setTimeout(() => {
      setBanner(null);
      setScanState(SCAN_STATE.IDLE);
    }, RESET_DELAY_MS);
  };

  const handleBarcodeScanned = async (scanPayload) => {
    if (scanState !== SCAN_STATE.SCANNING) {
      return;
    }

    const qrToken =
      typeof scanPayload?.data === 'string' ? scanPayload.data.trim() : '';

    if (!qrToken) {
      setScanState(SCAN_STATE.ERROR);
      setBanner({ type: 'error', message: 'Scanned QR code did not include a valid token.' });
      scheduleReset();
      return;
    }

    setScanState(SCAN_STATE.PROCESSING);
    setBanner(null);

    try {
      const response = await checkInAttendee(qrToken);
      const checkedInCount = Number(
        response?.attendanceSummary?.checkedInCount ?? response?.checkedInCount ?? 0
      );

      setBanner({
        type: 'success',
        message: `\u2713 Checked in! ${Number.isFinite(checkedInCount) ? checkedInCount : 0} attendees so far`,
      });
      Vibration.vibrate(100);
      setScanState(SCAN_STATE.SUCCESS);
    } catch (error) {
      setBanner({
        type: 'error',
        message: error?.message || 'Unable to check in this attendee.',
      });
      setScanState(SCAN_STATE.ERROR);
    } finally {
      scheduleReset();
    }
  };

  if (!allowed) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Text style={styles.barTitle} numberOfLines={1}>
            {eventTitle}
          </Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Access denied</Text>
          <Text style={styles.stateText}>
            Only organization leaders and admins can use attendee check-in.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Text style={styles.barTitle} numberOfLines={1}>
            {eventTitle}
          </Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.stateCard}>
          <ActivityIndicator size="large" color={COLORS.amber} />
          <Text style={styles.stateText}>Preparing camera...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Text style={styles.barTitle} numberOfLines={1}>
            {eventTitle}
          </Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Camera access needed</Text>
          <Text style={styles.stateText}>
            Allow camera access so you can scan attendee QR codes at the door.
          </Text>
          <TouchableOpacity
            style={styles.permissionBtn}
            onPress={() => requestPermission().catch(() => {})}
          >
            <Text style={styles.permissionBtnText}>Grant Camera Access</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.barTitle} numberOfLines={1}>
          {eventTitle}
        </Text>
        <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cameraWrap}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={
            scanState === SCAN_STATE.SCANNING ? handleBarcodeScanned : undefined
          }
        />

        <View style={styles.overlay} pointerEvents="none">
          {banner && (
            <View
              style={[
                styles.banner,
                banner.type === 'success' ? styles.successBanner : styles.errorBanner,
              ]}
            >
              <Text style={styles.bannerText}>{banner.message}</Text>
            </View>
          )}

          <View style={styles.viewfinder}>
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
          </View>

          <Text style={styles.hintText}>Point at attendee QR code</Text>

          {scanState === SCAN_STATE.PROCESSING && (
            <View style={styles.processingPill}>
              <ActivityIndicator size="small" color={COLORS.cream} />
              <Text style={styles.processingText}>Checking in attendee...</Text>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.ink,
  },
  topBar: {
    backgroundColor: COLORS.ink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomColor: COLORS.amber,
    borderBottomWidth: 3,
  },
  barTitle: {
    flex: 1,
    color: COLORS.cream,
    fontSize: 14,
    fontWeight: '700',
  },
  doneBtn: {
    backgroundColor: COLORS.amber,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  doneBtnText: {
    color: COLORS.ink,
    fontWeight: '800',
    fontSize: 12,
  },
  cameraWrap: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  banner: {
    position: 'absolute',
    top: 18,
    left: 14,
    right: 14,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  successBanner: {
    backgroundColor: 'rgba(19, 114, 55, 0.95)',
    borderColor: '#95e6b6',
  },
  errorBanner: {
    backgroundColor: 'rgba(140, 22, 22, 0.94)',
    borderColor: '#f3b8b8',
  },
  bannerText: {
    color: COLORS.cream,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
  },
  viewfinder: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: COLORS.amber,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderLeftWidth: 4,
    borderTopWidth: 4,
    borderTopLeftRadius: 8,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderTopRightRadius: 8,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderLeftWidth: 4,
    borderBottomWidth: 4,
    borderBottomLeftRadius: 8,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderBottomRightRadius: 8,
  },
  hintText: {
    marginTop: 18,
    color: COLORS.cream,
    fontSize: 14,
    fontWeight: '700',
  },
  processingPill: {
    position: 'absolute',
    bottom: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 14, 23, 0.85)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  processingText: {
    color: COLORS.cream,
    fontSize: 13,
    fontWeight: '600',
  },
  stateCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
    backgroundColor: COLORS.cream,
  },
  stateTitle: {
    color: COLORS.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  stateText: {
    color: COLORS.gray,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  permissionBtn: {
    marginTop: 8,
    backgroundColor: COLORS.blue,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  permissionBtnText: {
    color: COLORS.cream,
    fontSize: 13,
    fontWeight: '700',
  },
});
