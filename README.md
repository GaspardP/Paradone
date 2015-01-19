# Paradone #

Paradone is an Open-Source, peer-to-peer powered overlay network for
media diffusion in the browser. Its aim is to reduce bandwidth cost of
media file diffusion for the server and ISPs while providing a better
service quality to the end user.

- It uses a mesh overlay network to share media directly between the
  users
- It uses the new WebRTC API to provide full P2P capabilities directly
  inside the web browser
- It uses the new Media Source Extension API to play video with HTML5
- It's a full JavaScript solution which needs no plugin and is
  invisible to end users
- It's Open-Source and free to use, share and modify

The project was created for and is laureate of the Boost Your Code
2014 contest.

The documentation of the project is available on
[the wiki](https://github.com/GaspardP/Paradone/wiki/)

The license of the project is available in [the LICENSE file](LICENSE)

## Table of content

* [**Project Details**](#project-details)
  * [Why](#why)
  * [How it works](#how-it-works)
  * [Challenges](#challenges)
  * [License](#license)
* [**Getting Started**](#getting-started)
  * [Requirements](#requirements)
  * [Installation](#installation)
* [**Community**](#community)
  * [Wiki](#wiki)
  * [Mailing List](#mailing-list)
  * [Issue tracker](#issue-tracker)


## Project Details

### Why

Did you ever tried to see a video but had to wait every 3 seconds to
wait for it to load? I had this problem, a lot. That's why, seeing how
new API of HTML5 allow users to share information directly between
themselves, I decided to build a system using a
[Mesh overlay](https://en.wikipedia.org/wiki/Mesh_networking) allowing
media diffusion directly between users. This way the bandwidth's costs
for the server will decrease and users will be able to retrieve the
files faster.

### How it works

Paradone uses WebRTC API to create a mesh overlay between the
users. The first user will download the media directly from the
server. When a new user request the same media, the server will tell
him how to connect to the mesh where the file can be retrieved. The
new user will then download parts of the file from different users
and/or the server. Finally the parts are glued back together and
played with the MediaSource API and a HTML5 Video tag.

For a more technical description you can check the
[Communication Protocol](https://github.com/GaspardP/Paradone/wiki/Documentation-%E2%80%94-Communication-Protocol)
available on the wiki.

### Challenges  ###

- P2P does not mean “Pirate 2 Pirate”: P2P is often seen as a medium
  for illegal file sharing but it's not. The main goal of P2P is to
  allow decentralized communication between users. Decentralization
  means no more single point of failure (SPOF). In traditional
  client-server architecture, the server can handle a limited amount
  of users before failing. With a P2P solution, more users mean a
  better service.
- An evolving technology: The W3C specifications for both WebRTC and
  MSE are not finished yet. It means that the project will have to be
  modified when the final standards will be published.
- Web browser interoperation: As the standards are not published in
  final state yet, different browsers might implement different
  functionalities leading to difficulties in interoperation.

### License ###

Paradone is licensed under the Affero General Public License version 3
or later. See the [LICENSE](LICENSE) file for more information.

## Getting Started ##

### Requirements ###

#### User side ####

The user will need an up-to-date web browser supporting both WebRTC
and Media Source Extension. It can either be Firefox, Google Chrome
(or Chromium) or Opera.

The video served to the client must be played within a HTML5 Video
tag. You will need to check the codec of your file

#### Server side ####

The system needs a signaling server allowing users to initiate the
communication between them. WebRTC lets you choose your preferred
technology for signaling (websocket, xhr, email...).

- The mesh tracker allows new users to connect to the mesh and act as
  an entry point
- The media delivery server is your system used to serve video to the
  user

#### Developer side ####

The project is written in JavaScript and uses [npm](https://npmjs.com)
to manage all dependencies.

### Installation ###

Every functions of the project are referenced under the `paradone`
namespace. You can start using the project by adding the script to
your page and using the `start` function. The script will find the
video tags and start sharing it between your users. You can pass
options as argument to the function, see
[the documentation](https://github.com/GaspardP/Paradone/wiki/Documentation) for
more information.

```html
<script src="./some/path/to/paradone.js"></script>
<script>
  paradone.start(options)
</script>
```

## Community ##

### Contribute ###

There are multiple ways you can be part of the project. You can:
- Use it and fill an issue when you find a bug
- Fork it, modify it and propose a pull request
- Add documentation to the wiki
- Talk about it around you
- Share your ideas in our tracker

### Wiki ###

The wiki contains all information you need to know about the project
(architecture and implementation details, API…) for more information…
see [the wiki](https://github.com/GaspardP/Paradone/wiki/)

### Mailing List ###

You can [subcribe](https://sympa.inria.fr/sympa/subscribe/paradone) to
our [mailing list](https://sympa.inria.fr/sympa/info/paradone) to get
in touch with the team.

### Issue tracker ###

All [the issues](https://github.com/GaspardP/Paradone/issues) are
tracked on Github.

### Documentation ###

The full documentation is available on the
[wiki](https://github.com/GaspardP/Paradone/wiki/Documentation).
