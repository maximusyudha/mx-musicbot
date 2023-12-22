const { Client, GatewayIntentBits } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { createAudioPlayer, createAudioResource, joinVoiceChannel, getVoiceConnection, NoSubscriberBehavior } = require('@discordjs/voice');
const ytdl = require('ytdl-core');

const token = 'your-token';
const clientId = 'Your-ClientId';
const guildId = 'Your-guildid';

const commands = [
  {
    name: 'play',
    description: 'Play a song',
    options: [
      {
        name: 'song',
        type: 3, // STRING
        description: 'The URL or search term of the song',
        required: true,
      },
    ],
  },
  {
    name: 'skip',
    description: 'Skip the current song',
  },
  {
    name: 'stop',
    description: 'Stop the music',
  },
  {
    name: 'queue',
    description: 'Display the song queue',
  },
  {
    name: 'delete',
    description: 'Delete a song from the queue',
    options: [
      {
        name: 'index',
        type: 4, // INTEGER
        description: 'The index of the song to delete',
        required: true,
      },
    ],
  },
];

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates
  ] 
});

const queue = new Map();

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName, options } = interaction;

  if (commandName === 'play') {
    const song = options.getString('song');
    const connection = getVoiceConnection(interaction.guildId);

    if (!connection) {
      const newConnection = joinVoiceChannel({
        channelId: interaction.member.voice.channel.id,
        guildId: interaction.guildId,
        adapterCreator: interaction.guild.voiceAdapterCreator,
      });

      const player = createAudioPlayer({
        behaviors: {
          noSubscriber: NoSubscriberBehavior.Pause,
        },
      });

      try {
        const stream = ytdl(song, { filter: 'audioonly', quality: 'highestaudio' });
        const resource = createAudioResource(stream);

        player.play(resource);
        newConnection.subscribe(player);

        if (!queue.has(interaction.guildId)) {
          queue.set(interaction.guildId, [resource]);
        } else {
          queue.get(interaction.guildId).push(resource);
        }

        interaction.reply(`Added to the queue: ${song}`);
      } catch (error) {
        console.error(error);
        interaction.reply(`Error playing the song. Please try again.`);
      }
    } else {
      try {
        const stream = ytdl(song, { filter: 'audioonly', quality: 'highestaudio' });
        const resource = createAudioResource(stream);

        if (!queue.has(interaction.guildId)) {
          queue.set(interaction.guildId, [resource]);
        } else {
          queue.get(interaction.guildId).push(resource);
        }

        interaction.reply(`Added to the queue: ${song}`);
      } catch (error) {
        console.error(error);
        interaction.reply(`Error adding the song to the queue. Please try again.`);
      }
    }
  } else if (commandName === 'skip') {
    const connection = getVoiceConnection(interaction.guildId);
    if (connection) {
      connection.queue.shift();
      if (connection.queue.length > 0) {
        connection.play(connection.queue[0]);
        interaction.reply(`Skipped to the next song.`);
      } else {
        connection.destroy();
        queue.delete(interaction.guildId);
        interaction.reply(`Queue is empty. Leaving voice channel.`);
      }
    } else {
      interaction.reply(`Not connected to a voice channel.`);
    }
  } else if (commandName === 'stop') {
    const connection = getVoiceConnection(interaction.guildId);
    if (connection) {
      connection.destroy();
      queue.delete(interaction.guildId);
      interaction.reply(`Stopped the music and left the voice channel.`);
    } else {
      interaction.reply(`Not connected to a voice channel.`);
    }
  } else if (commandName === 'queue') {
    const connection = getVoiceConnection(interaction.guildId);
    if (connection) {
      const currentQueue = queue.get(interaction.guildId) || [];
      const queueList = currentQueue.map((resource, index) => {
        // Tambahkan pemeriksaan apakah metadata dan metadata.title ada sebelum mengakses properti 'title'
        const title = (resource.metadata && resource.metadata.title) ? resource.metadata.title : 'Unknown Title';
        return `${index + 1}. ${title}`;
      }).join('\n');
      interaction.reply(`Current Queue:\n${queueList}`);
    } else {
      interaction.reply(`Not connected to a voice channel.`);
    }
  } else if (commandName === 'delete') {
    const index = options.getInteger('index');
    const connection = getVoiceConnection(interaction.guildId);

    if (connection) {
      const currentQueue = queue.get(interaction.guildId) || [];
      if (index >= 1 && index <= currentQueue.length) {
        const deletedSong = currentQueue.splice(index - 1, 1)[0];
        interaction.reply(`Deleted song at index ${index}: ${deletedSong.metadata.title}`);
      } else {
        interaction.reply(`Invalid index. Please provide a valid index.`);
      }
    } else {
      interaction.reply(`Not connected to a voice channel.`);
    }
  }
});

client.login(token);