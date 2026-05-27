import { useState, useEffect } from 'react';
import { Text, View, StyleSheet, Alert, Vibration } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const API_URL = 'https://chessorganizerspro.com';

export default function QRScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned) return;
    setScanned(true);
    Vibration.vibrate(100);

    try {
      // QR contiene: chessorg://checkin/{tournamentPlayerId}
      const match = data.match(/chessorg:\/\/checkin\/(\d+)/);
      if (match) {
        const tpId = match[1];
        const res = await fetch(`${API_URL}/arbiters/players/${tpId}/check-in`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const json = await res.json();
        if (res.ok) {
          Alert.alert('✅ Check-in exitoso', 'Jugador registrado como presente');
        } else {
          Alert.alert('❌ Error', json.error || 'No se pudo realizar el check-in');
        }
      } else {
        Alert.alert('QR inválido', 'Este código no corresponde a un check-in de torneo');
      }
    } catch (err) {
      Alert.alert('Error de conexión', err.message);
    }

    setTimeout(() => setScanned(false), 3000);
  };

  if (!permission?.granted) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.title}>Permiso de cámara requerido</Text>
        <Text style={styles.subtitle}>Necesitamos acceso a la cámara para escanear códigos QR de check-in</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Escanear QR de check-in</Text>
      <Text style={styles.subtitle}>Apunta la cámara al código QR del jugador</Text>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        <View style={styles.overlay}>
          <View style={styles.scanFrame} />
        </View>
      </CameraView>
      {scanned && (
        <Text style={styles.scanningText}>Procesando...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
  },
  title: {
    color: '#f59e0b',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#f59e0b',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  scanningText: {
    color: '#f59e0b',
    fontSize: 14,
    marginVertical: 16,
  },
});
