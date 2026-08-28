import { useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { bindActionCreators } from 'redux'
import { Grid, Box } from '@mui/material'

// Actions
import * as mtrxActions from '../actions/mtrxControlActions.js'
import * as authActions from '../actions/authControlActions.js'

// Components
import AuthAd from '../components/AuthAd.jsx'
import MtrxReg from '../components/MtrxReg.jsx'
import MtrxPad from '../components/MtrxPad.jsx'

const MtrxContainer = () => {
  const dispatch = useDispatch()

  const mtrxControlRdcr = useSelector(state => state.mtrxControlRdcr)
  const authControlRdcr = useSelector(state => state.authControlRdcr)

  const mtrxControlActions = useMemo(() => bindActionCreators(mtrxActions, dispatch), [dispatch])
  const authControlActions = useMemo(() => bindActionCreators(authActions, dispatch), [dispatch])

  const { displayAd } = authControlRdcr
  const { displayReg, displayPad, errComponent } = mtrxControlRdcr

  const isOverlayActive = displayAd || displayReg || errComponent === 'MtrxReg'

  // Стили для оверлеев вынесены из тела рендера для производительности
  const centerOverlayStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 10,
    width: 'auto',
    pointerEvents: 'auto'
  }

  return (
    <Box 
      sx={{ 
        position: 'relative', 
        width: '100%', 
        minHeight: isOverlayActive ? '400px' : 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      
      {/* Центрирование AuthAd */}
      {displayAd && (
        <Box sx={centerOverlayStyle}>
          <AuthAd authControlRdcr={authControlRdcr} authControlActions={authControlActions} />
        </Box>
      )}

      {/* Центрирование MtrxReg */}
      {(displayReg || errComponent === 'MtrxReg') && (
        <Box sx={centerOverlayStyle}>
          <MtrxReg mtrxControlRdcr={mtrxControlRdcr} mtrxControlActions={mtrxControlActions} />
        </Box>
      )}

      <Grid 
        container 
        spacing={2} 
        sx={{ 
          justifyContent: 'center', 
          alignItems: 'center', 
          width: '100%' 
        }}
      >
        
        {/* Мессенджер */}
        {(displayPad || errComponent === 'MtrxPad') && (
          <Grid size={{ xs: 12, md: 'auto' }}>
            <MtrxPad mtrxControlRdcr={mtrxControlRdcr} mtrxControlActions={mtrxControlActions} showInput />
          </Grid>
        )}

      </Grid>
    </Box>
  )
}

export default MtrxContainer
