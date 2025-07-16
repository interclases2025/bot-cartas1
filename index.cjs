const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} = require('@whiskeysockets/baileys');

const qrcode = require('qrcode-terminal');
const fs = require('fs');

// 💌 Cargar cartas
const cartas = require('./cartas.json');

// 💾 Cargar contador
let contador = 0;
try {
  if (fs.existsSync('./contador.json')) {
    const data = JSON.parse(fs.readFileSync('./contador.json'));
    if (typeof data.ultima === 'number') {
      contador = data.ultima;
    }
  }
} catch (error) {
  console.error("⚠️ Error leyendo contador.json. Se usará 0:", error.message);
  contador = 0;
}

// 🔐 Solo ella puede activar el bot
const numeroPermitido = '573146530203@s.whatsapp.net'; // <-- cámbialo por el número real de tu novia

async function iniciarBot() {
  // 🔐 Autenticación multiarchivo (ideal para Railway y local)
  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    auth: state,
    version,
    printQRInTerminal: true, // 🔁 Siempre imprime QR si no hay sesión
    browser: ['Windows', 'Chrome', '100.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      qrcode.generate(qr, { small: true });
      console.log('📲 Escanea el QR para vincular tu WhatsApp');
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log('⚠️ Conexión cerrada. Código:', code);
      if (code !== DisconnectReason.loggedOut) iniciarBot();
    }

    if (connection === 'open') {
      console.log('✅ Bot conectado a WhatsApp');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    const msg = messages[0];

    const texto = msg.message?.conversation?.toLowerCase() || '';
    const remitente = msg.key.remoteJid;
    const esElla = remitente === numeroPermitido;
    const esEllaEscribiendo = !msg.key.fromMe && esElla;

    if (texto.includes('carta')) {
      if (!esEllaEscribiendo) {
        console.log(`❌ Ignorado: No fue ella escribiendo directamente.`);
        return;
      }

      if (!cartas.length) {
        console.log("❌ No hay cartas disponibles.");
        return;
      }

      const carta = cartas[contador % cartas.length];

      if (!carta || !carta.número || !carta.contenido) {
        console.log("❌ Carta inválida:", carta);
        return;
      }

      const mensaje = `📜 *Carta #${carta.número}* (${carta.estilo}):\n\n${carta.contenido}`;
      await sock.sendMessage(remitente, { text: mensaje });

      console.log(`✅ Carta #${carta.número} enviada a ${remitente}`);

      contador = (contador + 1) % cartas.length;
      fs.writeFileSync('./contador.json', JSON.stringify({ ultima: contador }));
    }
  });
}

iniciarBot();
