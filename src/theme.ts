import { ThemeOptions } from "@mui/material";

export const themeOptions: ThemeOptions = {
  palette: {
    mode: "dark",
    primary: {
      main: "#0f0",
      contrastText: "#f5f5f5",
    },
    background: {
      default: "#111111",
      paper: "#212121",
    },
  },
  typography: {},
  components: {
    MuiTableCell: {
      defaultProps: {
        sx: {
          padding: "5px 10px",
        },
      },
    },
  },
};
