import { useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { bindActionCreators } from 'redux'

import * as mtrxActions from '../actions/mtrxControlActions.js'
import * as authActions from '../actions/authControlActions.js'
import MenuAppBar from '../components/MenuAppBar.jsx'

const MenuAppContainer = () => {
  const dispatch = useDispatch()

  const mtrxControlActions = useMemo(() => bindActionCreators(mtrxActions, dispatch), [dispatch])
  const authControlActions = useMemo(() => bindActionCreators(authActions, dispatch), [dispatch])

  const mtrxControlRdcr = useSelector((state) => state.mtrxControlRdcr)
  const authControlRdcr = useSelector((state) => state.authControlRdcr)

  // Передаем переменные напрямую как пропсы, а не единым объектом commonProps
  return (
    <MenuAppBar 
      mtrxControlRdcr={mtrxControlRdcr}
      mtrxControlActions={mtrxControlActions}
      authControlRdcr={authControlRdcr}
      authControlActions={authControlActions}
    />
  )
}

export default MenuAppContainer
