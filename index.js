import express from "express";
import admin from "firebase-admin";
import mqtt from "mqtt";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://fir-test-1ab51-default-rtdb.firebaseio.com/"
});
const db = admin.database();

const app = express();
app.use(express.json());

// Configuración CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  next();
});

// MQTT Setup
const mqttClient = mqtt.connect('mqtt://broker.hivemq.com');

mqttClient.on('connect', () => {
  console.log('Conectado al broker MQTT');
  mqttClient.subscribe('catoor/servoState/set');
});

mqttClient.on('error', (err) => {
  console.error('Error en MQTT:', err);
});

// Listener para servoState (existente)
const servoRef = db.ref('servoState');
servoRef.on('value', (snapshot) => {
  const state = snapshot.val();
  if (state) {
    mqttClient.publish('catoor/servoState/get', state);
    console.log(`Publicado estado de servo en MQTT: ${state}`);
  }
});

// NUEVO: Listener para arduinoMode
const modeRef = db.ref('arduinoMode');
modeRef.on('value', (snapshot) => {
  const mode = snapshot.val();
  if (mode) {
    mqttClient.publish('catoor/arduino/mode', mode, { qos: 1 }, (err) => {
      if (err) {
        console.error('Error publicando modo:', err);
      } else {
        console.log(`Publicado modo en MQTT: ${mode}`);
      }
    });
  }
});

// Endpoint para modo (opcional, si aún lo necesitas)
/*app.post('/mode', (req, res) => {
  try {
    const { mode } = req.body;
    if (!mode || (mode !== 'addTag' && mode !== 'normal')) {
      return res.status(400).json({ error: 'Modo inválido' });
    }
    
    db.ref('arduinoMode').set(mode)
      .then(() => res.json({ success: true, mode }))
      .catch(err => {
        console.error('Error actualizando modo:', err);
        res.status(500).json({ error: 'Error al actualizar modo' });
      });
  } catch (error) {
    console.error('Error en /mode:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});
*/

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});

