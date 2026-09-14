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
        border: "1px dashed grey",
        borderRadius: 5,
      }}
    >
      <MenuAppContainer />
      <MtrxContainer />
      <AuthContainer />
      <Copyright showFull={true} />
    </Container>
  );
}
