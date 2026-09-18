import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Copyright from "./Copyright";
import AuthContainer from "./containers/AuthContainer.jsx";
import MenuAppContainer from "./containers/MenuAppContainer";
import MtrxContainer from "./containers/MtrxContainer.jsx";

export default function App() {
  return (
    <Container
      maxWidth="md"
      sx={{
        p: 2,
        mt: 2,
        // Основное окно держит высоту экрана: на старте контент не схлопывается
        // до одних иконок входа (вычитаем внешний отступ mt: 2 сверху и снизу)
        minHeight: "calc(100dvh - 32px)",
        boxSizing: "border-box",
        border: "1px dashed grey",
        borderRadius: 5,
        // Flex-колонка, чтобы футер с Copyright держался нижнего края окна
        display: "flex",
        flexDirection: "column",
      }}
    >
      <MenuAppContainer />
      <AuthContainer />
      <MtrxContainer />
      <Box sx={{ mt: "auto" }}>
        <Copyright showFull={true} />
      </Box>
    </Container>
  );
}
