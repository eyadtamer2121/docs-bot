import * as Discord from "discord.js";
import type { CommandType } from ".";
import lunr from "lunr";
import fetch from "node-fetch";
import he from "he";

const SEARCH_ENDPOINT = "/search/search_index.json";
const FOSSCORD_DOCS_BASE_URL = "https://docs.fosscord.com";

type MKDOCS_RESULT = {
	location: string;
	title: string;
	text: string;
};

type MKDOCS_SEARCH_RESULTS = {
	config: {
		lang: string[];
		separator: string;
		pipeline: string[];
	};
	docs: MKDOCS_RESULT[];
};

export default {
	name: "docs",
	description:
		"Search the Fosscord documentation and returns a link to the best",
	options: [
		{
			name: "query",
			description: "The query to search for",
			type: Discord.ApplicationCommandOptionType.String,
		},
	],
	exec: async (caller) => {
		const query =
			caller instanceof Discord.ChatInputCommandInteraction
				? caller.options.getString("query")
				: caller.args.join(" ");

		if (!query) {
			return FOSSCORD_DOCS_EMBED;
		}

		const res = await fetch(FOSSCORD_DOCS_BASE_URL + SEARCH_ENDPOINT);
		const search = (await res.json()) as MKDOCS_SEARCH_RESULTS;

		const index = lunr(function () {
			this.ref("location");
			this.field("title", { boost: 2 });
			this.field("location", { boost: 1 });
			this.field("text");

			search.docs.forEach((x) => this.add(x));
		});

		const replaceHtml = (x: string) =>
			x
				.replaceAll("<p>", "")
				.replaceAll("</p>", "\n\n")
				.replaceAll("<pre><code>", "```")
				.replaceAll("</code></pre>", "```")
				.replaceAll("<code>", "`")
				.replaceAll("</code>", "`")
				.replaceAll("<ol>", "")
				.replaceAll("</ol>", "\n")
				.replaceAll("<li>", "*");

		const searchResult = index.search(query);

		const docs = searchResult
			.map((x) => search.docs.find((y) => y.location == x.ref))
			.map((x) => ({
				...x,
				title: replaceHtml(x?.title || ""),
				text: replaceHtml(x?.text || ""),
			}))
			.filter((x) => x.text.length > 0) as MKDOCS_RESULT[];

		if (!docs || docs.length == 0)
			return "Could not find any matching documents. Try a simpler query.";

		const main = docs.shift() as MKDOCS_RESULT;

		const textGoal = main.text.slice(0, 300);
		const lastCodeBlockStart = textGoal.lastIndexOf("`");
		const description =
			lastCodeBlockStart !== -1
				? main.text.slice(
						0,
						lastCodeBlockStart +
							main.text
								.slice(lastCodeBlockStart + 3)
								.indexOf("`") +
							6,
				  )
				: textGoal;

		return {
			embeds: [
				{
					title: main.title,
					url: `${FOSSCORD_DOCS_BASE_URL}/${main.location}`,
					description: he.decode(description) + " ...",
					fields: docs
						.filter((x) => !!x.text)
						.map((x) => ({
							name: x.title,
							value: `[Link](${FOSSCORD_DOCS_BASE_URL}/${x.location})`,
							inline: true,
						}))
						.slice(0, 4),
					footer: {
						text: "https://docs.fosscord.com",
					},
				},
			],
		};
	},
} as CommandType;

const FOSSCORD_DOCS_EMBED = {
	embeds: [
		{
			title: "Fosscord Documentation",
			url: FOSSCORD_DOCS_BASE_URL,
			description:
				"Fosscord is a free and open source, selfhostable, Discord.com-compatible chat platform.",
			fields: [
				{
					inline: true,
					name: "FAQ",
					value: `[Link](${FOSSCORD_DOCS_BASE_URL}/faq)`,
				},
				{
					inline: true,
					name: "Server Setup",
					value: `[Link](${FOSSCORD_DOCS_BASE_URL}/server/setup)`,
				},
				{
					inline: true,
					name: "Reverse Proxies",
					value: `[Link](${FOSSCORD_DOCS_BASE_URL}/setup/server/reverseProxy)`,
				},
				{
					inline: true,
					name: "Configuration",
					value: `[Link](${FOSSCORD_DOCS_BASE_URL}/setup/server/configuration)`,
				},
				{
					inline: true,
					name: "Security",
					value: `[Link](${FOSSCORD_DOCS_BASE_URL}/setup/server/security/)`,
				},
				{
					inline: true,
					name: "Contributing",
					value: `[Link](${FOSSCORD_DOCS_BASE_URL}/contributing)`,
				},
			],
		},
	],
};
