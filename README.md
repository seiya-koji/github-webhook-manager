# GitHub Webhook Manager

[![codecov](https://codecov.io/gh/seiya-koji/github-webhook-manager/graph/badge.svg)](https://codecov.io/gh/seiya-koji/github-webhook-manager)
[![VS Marketplace Version](https://badgen.net/vs-marketplace/v/seiya-koji.github-webhook-manager?label=version)](https://marketplace.visualstudio.com/items?itemName=seiya-koji.github-webhook-manager)
[![VS Marketplace Installs](https://badgen.net/vs-marketplace/i/seiya-koji.github-webhook-manager?label=installs)](https://marketplace.visualstudio.com/items?itemName=seiya-koji.github-webhook-manager)
[![VS Marketplace Rating](https://badgen.net/vs-marketplace/rating/seiya-koji.github-webhook-manager?label=rating)](https://marketplace.visualstudio.com/items?itemName=seiya-koji.github-webhook-manager)
[![Open VSX Version](https://img.shields.io/open-vsx/v/seiya-koji/github-webhook-manager?label=open%20vsx)](https://open-vsx.org/extension/seiya-koji/github-webhook-manager)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A VS Code extension that lets you **review webhook delivery history (Recent Deliveries)** and **redeliver** them for your GitHub repositories — all without leaving VS Code for the GitHub settings page in your browser.

## Features

- 🌳 Tree view of the target repository's **webhooks** in a dedicated Activity Bar view, grouped by their delivery **host**.
- 🌿 Deliveries are grouped by **branch** under each webhook, so you can quickly find the pushes, pull requests, or branch create/delete events that matter.
- 📜 Each delivery shows its **event name, status code, delivery status, and whether it was a redelivery** at a glance.
- 🔎 Click a delivery to see its full **request / response details** rendered in a formatted Webview panel.
- 🔁 Right-click a delivery → **Redeliver** for one-click redelivery (with a confirmation dialog).
- 🌐 Jump to GitHub when you need the full browser UI — open a **webhook's settings page** from its context menu, or the repository's **Webhooks list** from the view's title bar.
- 🏢 Works with **github.com and GitHub Enterprise Server** — the host is resolved from your git remote automatically.
- 🔐 Authentication uses VS Code's built-in GitHub sign-in — no manual personal access token management required.

## Requirements

- VS Code `^1.85.0`
- A GitHub account with administrator-equivalent permissions on the target repository
- Consent to the **`admin:repo_hook`** scope on first use (required to view and redeliver webhooks)

## Installation

Install it from the Visual Studio Code Marketplace.

<https://marketplace.visualstudio.com/items?itemName=seiya-koji.github-webhook-manager>

## Usage

1. Open the **GitHub Webhooks** icon in the Activity Bar.
2. On first use, you'll be prompted to sign in to GitHub — grant consent (the `repo` and `admin:repo_hook` scopes).
3. The target repository is auto-detected from your workspace's git remote (`upstream` is preferred over `origin`). A GitHub remote is required — if none is found, the view shows a short notice instead of webhooks.
4. Expand a **host → webhook → branch** to browse its delivery history.
5. Click a delivery to open its details. To redeliver, right-click the delivery → choose **Redeliver**, and it will be resent after confirmation.
6. Need the full GitHub UI? Click the **GitHub icon** in the view's title bar to open the repository's Webhooks page, or right-click a **webhook** → **Open Webhook Settings on GitHub** to jump straight to that hook's settings.

> [!NOTE]
> Due to GitHub's specifications, only deliveries from the **last 3 days** can be redelivered.
