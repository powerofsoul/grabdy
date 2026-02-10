import '@mui/material/styles';

declare module '@mui/material/styles' {
  interface KindlePalette {
    cream: string;
    parchment: string;
    sepia: string;
    inkBrown: string;
    codeBlockBg: string;
    codeBlockText: string;
    syntaxMethod: string;
    syntaxKey: string;
    syntaxString: string;
    syntaxNumber: string;
  }

  interface Palette {
    kindle: KindlePalette;
  }

  interface PaletteOptions {
    kindle?: KindlePalette;
  }
}
