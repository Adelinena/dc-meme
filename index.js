// === IMPORT LIBRARY ===
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActivityType
} = require("discord.js");
const fs = require("fs");

// === CONFIGURASI ===
const token = process.env.TOKEN; 
const path = "./data.json";

const servers = [
  {
    name: "Mevelyn",
    color: 0x5865F2,
    storageChannelId: "1403817828431302687",
    uangChannelId: "",
    logChannelId: "1397248753102094437"
  },
  {
    name: "Pfarm",
    color: 0x2ECC71,
    storageChannelId: "1407794205589377108",
    uangChannelId: "1407794205589377109",
    logChannelId: "1407794205589377110"
  }
];

// === ITEM LIST ===
const items = [
  { key: "seed", emoji: "🌰", label: "Seed" },
  { key: "wheat", emoji: "🌾", label: "Wheat" },
  { key: "potato", emoji: "🥔", label: "Potato" },
  { key: "melon", emoji: "🍉", label: "Melon" },
  { key: "orange", emoji: "🍊", label: "Orange" },
  { key: "marijuana", emoji: "🌱", label: "Marijuana" }
];

// === LOAD DATA ===
let data = fs.existsSync(path)
  ? JSON.parse(fs.readFileSync(path))
  : {
      storage: Object.fromEntries(items.map(i => [i.key, 0])),
      uang: 0,
      embedMessageIds: {}
    };

function saveData() {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

// === EMBED CREATOR ===
function createStorageEmbed(server) {
  let desc = items
    .map(i => `${i.emoji} **${i.label}** → \`${(data.storage[i.key] || 0).toLocaleString()}\``)
    .join("\n");

  return new EmbedBuilder()
    .setColor(server.color)
    .setTitle(`📦 ${server.name} Storage Inventory`)
    .setDescription(desc)
    .setFooter({ text: "Global Storage • Real-time" })
    .setTimestamp();
}

function createUangEmbed(server) {
  return new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(`💰 ${server.name} Wallet`)
    .setDescription(`Saldo saat ini: \`Rp ${data.uang.toLocaleString()}\``)
    .setFooter({ text: "Global Balance • Real-time" })
    .setTimestamp();
}

// === BUTTONS ===
function storageButtons(serverName) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`masuk_barang_${serverName}`).setLabel("➕ Masuk").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`keluar_barang_${serverName}`).setLabel("➖ Keluar").setStyle(ButtonStyle.Danger)
  );
}

function uangButtons(serverName) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`uang_masuk_${serverName}`).setLabel("💵 Tambah").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`uang_keluar_${serverName}`).setLabel("💸 Kurangi").setStyle(ButtonStyle.Danger)
  );
}

// === PASTIKAN EMBED ADA ===
async function ensureEmblemExists(client, server) {
  const storageChannel = await client.channels.fetch(server.storageChannelId);
  const uangChannel = server.uangChannelId ? await client.channels.fetch(server.uangChannelId) : null;

  if (!data.embedMessageIds[server.name]) {
    data.embedMessageIds[server.name] = { storage: "", uang: "" };
  }

  if (!data.embedMessageIds[server.name].storage) {
    const msg = await storageChannel.send({
      embeds: [createStorageEmbed(server)],
      components: [storageButtons(server.name)]
    });
    data.embedMessageIds[server.name].storage = msg.id;
  }

  if (uangChannel && !data.embedMessageIds[server.name].uang) {
    const msg = await uangChannel.send({
      embeds: [createUangEmbed(server)],
      components: [uangButtons(server.name)]
    });
    data.embedMessageIds[server.name].uang = msg.id;
  }

  saveData();
}

// === UPDATE EMBED ===
async function updateAllEmbeds(client) {
  for (const srv of servers) {
    if (!data.embedMessageIds[srv.name]) continue;

    const storageMsg = await client.channels.fetch(srv.storageChannelId)
      .then(c => c.messages.fetch(data.embedMessageIds[srv.name].storage))
      .catch(() => null);

    const uangMsg = srv.uangChannelId
      ? await client.channels.fetch(srv.uangChannelId)
        .then(c => c.messages.fetch(data.embedMessageIds[srv.name].uang))
        .catch(() => null)
      : null;

    if (storageMsg) await storageMsg.edit({ embeds: [createStorageEmbed(srv)], components: [storageButtons(srv.name)] });
    if (uangMsg) await uangMsg.edit({ embeds: [createUangEmbed(srv)], components: [uangButtons(srv.name)] });
  }
}

// === CLIENT ===
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Message, Partials.Channel, Partials.User]
});

client.once("ready", async () => {
  console.log(`✅ Bot aktif sebagai ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: "Global Storage 📦", type: ActivityType.Watching }],
    status: "online"
  });

  for (const srv of servers) {
    await ensureEmblemExists(client, srv);
  }
  await updateAllEmbeds(client);
});

// === INTERAKSI ===
client.on("interactionCreate", async interaction => {
  if (interaction.isButton()) {
    const [action, type, serverName] = interaction.customId.split("_");
    const modal = new ModalBuilder()
      .setCustomId(`${action}_${type}_${serverName}_modal`)
      .setTitle(type === "barang" ? "Manajemen Barang" : "Transaksi Uang")
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("item")
            .setLabel(type === "barang" ? "Nama barang (wheat, potato, dll)" : "Jumlah (angka)")
            .setStyle(TextInputStyle.Short)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("jumlah")
            .setLabel("Jumlah")
            .setStyle(TextInputStyle.Short)
        )
      );
    await interaction.showModal(modal);
  }

  else if (interaction.isModalSubmit()) {
    const [action, type] = interaction.customId.replace("_modal", "").split("_");
    const item = interaction.fields.getTextInputValue("item").trim().toLowerCase();
    const jumlah = parseInt(interaction.fields.getTextInputValue("jumlah"));

    if (type === "barang" && !(item in data.storage)) {
      return interaction.reply({ content: `❌ Item **${item}** tidak valid.`, ephemeral: true });
    }

    let logMsg = "";
    if (action === "masuk" && type === "barang") {
      data.storage[item] += jumlah;
      logMsg = `📥 ${interaction.user} menambahkan **${jumlah}** ${item} ke storage.`;
    }
    else if (action === "keluar" && type === "barang") {
      data.storage[item] = Math.max(0, data.storage[item] - jumlah);
      logMsg = `📤 ${interaction.user} mengeluarkan **${jumlah}** ${item} dari storage.`;
    }
    else if (action === "uang" && type === "masuk") {
      data.uang += jumlah;
      logMsg = `💵 ${interaction.user} menambah uang sebesar **Rp ${jumlah.toLocaleString()}**.`;
    }
    else if (action === "uang" && type === "keluar") {
      data.uang = Math.max(0, data.uang - jumlah);
      logMsg = `💸 ${interaction.user} mengurangi uang sebesar **Rp ${jumlah.toLocaleString()}**.`;
    }

    saveData();
    await updateAllEmbeds(client);

    // Kirim log ke semua server
    for (const s of servers) {
      try {
        const logChannel = await client.channels.fetch(s.logChannelId);
        await logChannel.send(logMsg);
      } catch (err) {
        console.error(`Gagal kirim log ke server ${s.name}:`, err);
      }
    }

    await interaction.reply({ content: "✅ Data berhasil diperbarui.", ephemeral: true });
  }
});

client.login(token);
