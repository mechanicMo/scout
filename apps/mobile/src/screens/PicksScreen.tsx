import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

export function PicksScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Scout is finding your picks...</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#100a04', alignItems: 'center', justifyContent: 'center' },
  text: { color: '#e8a020', fontSize: 16 },
})
