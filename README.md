# NamUs Case Tracker Chrome Extension

A Chrome extension that allows users to track and view NamUs missing person and unidentified remains cases in a side panel.

## Features

- Adds a "Track Case" button to NamUs case pages
- Displays case information in a side panel
- Persists tracked cases across browser sessions
- Works across tabs on the NamUs website
- View detailed case information including images and case details
- Manage a list of tracked cases

## Installation

### From Source

1. Clone this repository:
   ```
   git clone https://github.com/blockpass253/namus-extension.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" in the top right corner

4. Click "Load unpacked" and select the directory containing the extension files

### From Chrome Web Store (Coming Soon)

The extension will be available on the Chrome Web Store in the future.

## Usage

1. Visit a NamUs case page (e.g., https://www.namus.gov/MissingPerson/Case#/12345)

2. Click the "Track Case" button that appears in the top row of the page

3. The side panel will open with the case information

4. You can switch between the current case and your list of tracked cases using the tabs in the side panel

5. To remove a case from tracking, click the "Remove from Tracked" button

## Development

### Setup

```
npm install
```

### Build

```
npm run build
```

### Package for Distribution

```
npm run zip
```

## License

ISC

## Acknowledgments

- [NamUs](https://www.namus.gov/) - National Missing and Unidentified Persons System
