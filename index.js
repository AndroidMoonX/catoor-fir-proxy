import express from "express";
import admin from "firebase-admin";
import mqtt from "mqtt";
import cors from "cors";  // 👈 Nuevo import

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://fir-test-1ab51-default-rtdb.firebaseio.com/"
});
const db = admin.database();

const app = express();
app.use(express.json());

// Middleware para loguear peticiones (se mantiene igual)
app.use((req, res, next) => {
  console.log(`Recibida petición: ${req.method} ${req.url}`, req.body);
  next();
});

// Configuración CORS específica para /mode 👇
const corsOptions = {
  origin: "*", // Permitir cualquier origen (en producción usa tu dominio iOS)
  methods: "POST" // Solo permitir POST
};

// MQTT setup (se mantiene igual)
const mqttClient = mqtt.connect('mqtt://broker.hivemq.com');

mqttClient.on('connect', () => {
  console.log('Conectado al broker MQTT');
  mqttClient.subscribe('catoor/servoState/set');
});

// ... (todo el resto del código MQTT y Firebase se mantiene IGUAL)

// Endpoint para cambiar modo 👇 (ÚNICO cambio relevante)
app.post('/mode', cors(corsOptions), (req, res) => {  // 👈 Aplica CORS solo aquí
  try {
    const { mode } = req.body;

    if (mode !== 'addTag' && mode !== 'normal') {
      return res.status(400).json({ error: 'Modo inválido. Debe ser "addTag" o "normal".' });
    }

    mqttClient.publish('catoor/arduino/mode', mode, (err) => {
      if (err) {
        console.error('Error publicando modo en MQTT:', err);
        return res.status(500).json({ error: 'Error publicando en MQTT' });
      }

      console.log(`Modo enviado a Arduino: ${mode}`);
      return res.json({ success: true, mode });
    });
  } catch (error) {
    console.error('Error en /mode:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});



