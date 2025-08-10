# Reddit Comment Expander

![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)
![License](https://img.shields.io/badge/license-MPL%202.0-green.svg)

A userscript that automatically expands all comments on Reddit threads by clicking "X more replies" buttons and expanding collapsed comments. Features a clean UI with progress tracking and works seamlessly with Reddit's latest interface.

## Features

- **One-click expansion**: Single button to expand all comments in a thread
- **Progress tracking**: Visual progress bar showing expansion status
- **Smart detection**: Finds both "more replies" buttons and collapsed comment sections
- **Shadow DOM support**: Works with Reddit's modern web components
- **Non-intrusive UI**: Clean, dark-themed floating widget
- **Efficient processing**: Debounced scanning with built-in rate limiting
- **Resume functionality**: Can expand additional comments that load after initial run

## Installation

1. Install a userscript manager:
   - [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Safari, Edge)
   - [Greasemonkey](https://www.greasespot.net/) (Firefox)
   - [Violentmonkey](https://violentmonkey.github.io/) (Chrome, Firefox, Edge)

2. Install the script:
   - **Direct install**: [reddit-comment-expander.user.js](https://github.com/InvictusNavarchus/reddit-comment-expander/raw/refs/heads/master/reddit-comment-expander.user.js)
   - **Manual install**: Copy the script content and create a new userscript in your manager

## Usage

1. Navigate to any Reddit thread (e.g., `https://reddit.com/r/AskReddit/comments/...`)
2. Look for the floating "Expand All Comments" button in the bottom-right corner
3. Click the button to start automatic expansion
4. Watch the progress bar as comments are expanded
5. Use "Expand More (if any)" if additional comments load later

## How It Works

The script uses advanced DOM traversal techniques to:

- Locate `faceplate-partial` elements containing "more replies" buttons
- Find collapsed `shreddit-comment` elements with expand buttons
- Navigate shadow DOM structures to access hidden elements
- Monitor DOM changes for dynamically loaded content
- Process buttons with appropriate delays to avoid server overload

## Compatibility

- ✅ **Reddit domains**: `*.reddit.com`
- ✅ **Modern Reddit UI**: Fully compatible with current interface
- ✅ **Shadow DOM**: Works with web components
- ✅ **Dynamic loading**: Handles AJAX-loaded content

## Technical Details

- **Debounced scanning**: 500ms delay between DOM change detection and re-scanning
- **Rate limiting**: 200ms delay between button clicks
- **Completion detection**: 3-second timeout to determine when expansion is complete
- **Memory efficient**: Marks processed buttons to avoid duplicate clicks

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

This project is licensed under the Mozilla Public License 2.0 - see the [LICENSE](LICENSE) file for details.

