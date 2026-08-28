import Container        from '@mui/material/Container'
import MenuAppContainer from './containers/MenuAppContainer'
import MtrxContainer    from './containers/MtrxContainer.jsx'
import Copyright        from './Copyright'

export default function App() {
  return (
    <Container
      maxWidth="md"
      sx={{
        p: 2,
        mt: 2,
        border: '1px dashed grey',
        borderRadius: 5,
      }}
    >
      <MenuAppContainer />
      <MtrxContainer />
      <Copyright showFull={true}/>
    </Container>
  )
}
