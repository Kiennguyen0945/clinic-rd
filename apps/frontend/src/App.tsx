import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [data, setData] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/roles')
        const result = await response.json()
        setData(result)
      } catch (error) {
        console.error(error)
      }
    }

    fetchData()
  }, [])

  return (
    <div>
      <h1>Data from backend</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  )
}


export default App

