const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require("discord.js");
const config = require("./config.json");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const AdicionarUsuario = new Set();

client.on("ready", () => {
  console.log(`${client.user.tag} está online!`);
});

client.on("messageCreate", async message => {
  if (message.author.bot || message.content !== "!ticket") return;

  if (message.author.id === config.autorizado) {
    const embed = new EmbedBuilder()
      .setColor("Default")
      .setAuthor({ name: "Suporte" })
      .setDescription("Crie um Ticket reagindo abaixo!");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
      .setCustomId("criar_ticket")
      .setLabel("✉️ Criar Ticket")
      .setStyle(ButtonStyle.Success)
    );

    await message.channel.send({
      embeds: [embed],
      components: [row]
    });
  }
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

  if (interaction.customId === "criar_ticket") {
    const menu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
      .setCustomId("tipo_suporte")
      .setPlaceholder("Escolha a categoria do seu atendimento")
      .addOptions([{
          label: "Suporte Geral",
          value: "suporte_geral",
          description: "Suporte e orientação para uma variedade de assuntos",
          emoji: "📋",
        },
        {
          label: "Denúncias",
          value: "denuncias",
          description: "Relate atitudes inadequadas e violações de regras",
          emoji: "⚠️",
        },
        {
          label: "Parcerias",
          value: "parcerias",
          description: "Informações e discussões sobre parcerias",
          emoji: "🤝",
        },
      ])
    );

    await interaction.reply({
      content: "Qual é o motivo do seu ticket?",
      components: [menu],
      ephemeral: true
    });
  } else if (interaction.customId === "tipo_suporte") {
    const tipo = interaction.values[0];
    const suporte = tipo === "suporte_geral" ? "Suporte Geral" : tipo === "denuncias" ? "Denúncias" : "Parcerias";

    const existente = interaction.guild.channels.cache.find(channel =>
      channel.name === `ticket-${interaction.user.username.toLowerCase()}` && channel.parentId === config.categoria);

    if (existente) {
      return interaction.update({
        content: "Você já tem um ticket em aberto",
        components: [],
        ephemeral: true
      });
    }

    const canal = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: 0,
      parent: config.categoria,
      permissionOverwrites: [{
          id: interaction.guild.id,
          deny: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
        },
        {
          id: interaction.user.id,
          allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
        },
        {
          id: config.suporte,
          allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
        }
      ],
    });

    const embed = new EmbedBuilder()
      .setColor("Default")
      .setAuthor({ name: `Tipo de Atendimento: ${suporte}` })
      .setDescription(`Olá ${interaction.user}\nNossa equipe estará com você o mais rápido possível. Enquanto isso, sinta-se à vontade para descrever o seu problema ou questão em detalhes.`)
      .setTimestamp()
      .setFooter({
        text: interaction.guild.name,
        iconURL: interaction.guild.iconURL({
          dynamic: true,
          extension: "png",
          size: 4096
        })
      })

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
      .setCustomId("adicionar_usuario_ticket")
      .setLabel("➕ Adicionar Usuário")
      .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
      .setCustomId("fechar_ticket")
      .setLabel("🔒 Fechar Ticket")
      .setStyle(ButtonStyle.Danger)
    );

    canal.send({
      content: `${interaction.user}`,
      embeds: [embed],
      components: [row]
    })

    await interaction.update({
      content: `Seu canal de ticket foi criado: ${canal.toString()}`,
      components: [],
      ephemeral: true
    });
  } else if (interaction.customId === "adicionar_usuario_ticket") {
    if (!interaction.member.roles.cache.has(config.suporte)) {
      return interaction.reply({
        content: "Você não possui as permissões necessárias para adicionar usuários a este ticket",
        ephemeral: true
      });
    }

    interaction.reply({
      content: "Informe o ID do usuário que deseja incluir no ticket",
      ephemeral: true
    });

    AdicionarUsuario.add(interaction.user.id);
  } else if (interaction.customId === "fechar_ticket") {
    if (!interaction.member.roles.cache.has(config.suporte)) {
      return interaction.reply({
        content: "Você não possui as permissões necessárias para encerrar este ticket",
        ephemeral: true
      });
    }

    await interaction.channel.delete().catch(() => {
      interaction.reply({
        content: "Ocorreu um erro durante a tentativa de exclusão deste ticket. Solicitamos que tente novamente ou proceda com a exclusão de forma manual, por gentileza",
        ephemeral: true
      });
    });
  }
});

client.on("messageCreate", async message => {
  if (message.author.bot) return;

  if (AdicionarUsuario.has(message.author.id)) {
    await message.delete()
    const user = message.content.trim();
    const channel = message.channel;

    try {
      const member = await message.guild.members.fetch(user);
      await channel.permissionOverwrites.edit(member, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });
      message.channel.send({
        content: `O usuário <@${user}> foi incluído com sucesso no ticket`
      });
    } catch (error) {
      message.reply({
        content: "Não foi possível adicionar o usuário. Certifique-se de que o ID está correto"
      });
    }

    AdicionarUsuario.delete(message.author.id);
  }
});


client.login(config.token)