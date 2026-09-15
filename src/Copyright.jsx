import { Box, Link, Stack, Typography } from "@mui/material";
import PropTypes from "prop-types";
import { useEffect } from "react";

import { dependencies, devDependencies, version } from "../package.json";

function Copyright(props) {
  if (import.meta.env.DEV) console.log("Copyright hook");

  const { showFull } = props;

  useEffect(() => {
    if (import.meta.env.DEV) console.log("Copyright MOUNT");

    return () => {
      if (import.meta.env.DEV) console.log("Copyright UNMOUNT");
    };
  }, []);

  return (
    <Typography
      variant="body2"
      align="center"
      color="text.secondary"
      sx={{
        mt: showFull ? 2 : 0,
        fontSize: 11,
        color: "text.secondary",
      }}
    >
      <Link
        color="inherit"
        href="https://github.com/ars-anosov/matrix-react"
        underline="none"
        sx={{
          fontWeight: "bold",
          "&:hover": { textDecoration: "underline" },
        }}
      >
        v.{version}
      </Link>
      {showFull && (
        <Stack spacing={0.2} sx={{ m: 1 }}>
          <Box>
            Powered by matrix-js-sdk {dependencies["matrix-js-sdk"]}, ky {dependencies.ky}
          </Box>
          <Box>
            react-dom {dependencies["react-dom"]}, react-redux {dependencies["react-redux"]}, @mui/material {dependencies["@mui/material"]}
          </Box>
          <Box>
            vite {devDependencies.vite}, @vitejs/plugin-react {devDependencies["@vitejs/plugin-react"]}, @biomejs/biome {devDependencies["@biomejs/biome"]}
          </Box>
          <Box sx={{ mt: 1 }}>Copyright © ars {new Date().getFullYear()}</Box>
        </Stack>
      )}
    </Typography>
  );
}

Copyright.propTypes = {
  showFull: PropTypes.bool.isRequired,
};

export default Copyright;
