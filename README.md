# Discord録音Bot

Discordのボイスチャットを録音するためのBotです。

このBotでは、全てのユーザーの発言内容を全て統合して、1つのMP3ファイルとして保存します。

## 導入方法

### 環境

- Node.js: v12以上が必須です。https://nodejs.org/ja/download/ よりインストーラを取得できます。
- npm: Node.jsをインストールすると標準で付属しています。使用はインストール時のみのため、使用を希望されない方は、package.json の内容を参照して設定を行っても構いません。
- FFmpeg: 音声のmp3圧縮に使用します。https://jp.videoproc.com/edit-convert/how-to-download-and-install-ffmpeg.htm などを参考にインストールしてください。

### インストール方法

#### 1. このリポジトリ全体をCloneまたはダウンロードしてください。

#### 2. 内部で使用するライブラリの導入を行います。

使用しているOSに合わせて `setup-windows.bat`, `setup-mac.command`, `setup-linux.sh` のいずれかを実行してください。（内部で npm コマンドが使用されています。予めNode.jsをインストールし、パスを通す等の準備を行ってください）

#### 3. このプログラムと連携させるDiscord Botを作成します。

https://discordpy.readthedocs.io/ja/latest/discord.html を参考に、Discord Botを作成してください。同じサーバ内で複数並行して使用したい場合は、その数だけ別々にDiscord Botを作成する必要があります。

#### 4. 環境変数の設定を行います。下記の説明に従って`.env`ファイルを作成してください。

.envでは、「キー=値」の形で1行に1つのデータを記述します。以下では、具体的なキー名と対応する値について説明します。

- NUM_BOTS: 並行起動されるBotの数を指定します。値は算用数字で指定してください。
- DISCORD_TOKEN_1: Discord Botのトークンを指定します。末尾の数字を連番で変えて、NUM_BOTSと同じ個数を指定してください。（多すぎる分の指定は単に無視されます）
- OUTPUT_DIR: 録音ファイルの保存先を指定します。絶対パスまたは`index.js`があるフォルダからの相対パスで指定してください。指定しない場合、`index.js`直下の`recordings`フォルダとなっています。

(`.env.template`を参考に設定してください)

#### 5. (任意) Botコマンドを設定します。

`auth.json`を編集することで、Bot呼び出しのためのコマンドを変更することができます。デフォルトは `?rec ***`という形ですが、'prefix'の値を変更すれば任意のコマンドで呼び出し可能です。

- prefixを指定する場合、末尾にスペースを含めてください。含めない場合、コマンドは`?rec start`ではなく`?recstart`のような形になります。

## 機能・使用方法

### 起動方法

`index.js`が保存されているディレクトリに移動し、`node index.js`コマンドを実行することでBotが起動されます。
- 起動補助ツールとして、`starter-windows.bat`, `starter-mac.command`, `starter-linux.sh` を用意しています。これらのうち対応するファイルをダブルクリック等で実行することでもBot起動が可能です。
- 以上2ついずれについても、Node.jsのインストールとパス設定が必要です。ご注意ください。

### Botの招待

Discord Developer Portalからアプリケーションを選択し、OAuth2 > URL Generator にアクセスしてください。この際、以下の権限設定が必要です。
#### SCOPES:
 - bot

#### BOT PERMISSIONS:
 - Read Messages/View Channels (GENERAL PERMISSIONS)
 - Send Messages (TEXT PERMISSIONS)
 - Connect (VOICE PERMISSIONS)
 - Speak (VOICE PERMISSIONS)

ここで生成したBot招待リンクを用いることで、使用したいDiscordサーバにBotを導入することができます。

（参考: https://discordpy.readthedocs.io/ja/latest/discord.html#inviting-your-bot）

### Botの使用法

`?rec `から始まるテキストメッセージに反応して、Botが録音を開始・終了します。（`auth.json`でprefixを変更した場合は、設定した内容に従います）

#### ?rec start [保存先フォルダ名(省略可)] [ファイル名]
 - コマンド実行者が参加しているボイスチャンネルで録音を開始します
 - 保存先フォルダ名: 最初のプロパティと同名のフォルダが録音先にあった場合、そのフォルダに保存されます。フォルダが存在しなかった場合、ファイル名の一部として扱われます。
 - ファイル名: 保存されるファイル名を指定します。スペースが含まれていた場合、アンダーバーに変換されます。なお、実際には、ファイル名の末尾にチャンネル名と録音開始時刻が追加されます。

#### ?rec start_ch [チャンネル名] [保存先フォルダ名(省略可)] [ファイル名]
 - 指定したチャンネルで録音を開始します。
 - チャンネル名: 録音する対象のチャンネル名を指定します。スペースを含む名前は指定できない点に注意してください。

#### ?rec stop [チャンネル名(省略可)]
 - 録音を終了します。
 - チャンネル名: 録音を終了する対象のチャンネル名を指定します。スペースを含む名前は指定できない点に注意してください。
 - チャンネル名を指定しなかった場合、コマンド実行者が参加しているボイスチャンネルの録音を終了します。
