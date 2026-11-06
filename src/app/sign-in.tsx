import { Keyboard, KeyboardAvoidingView, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoginScreen } from '@/components/login-screen';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export default function SignIn() {
  return (
    <ThemedView style={styles.fill}>
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        {/* Tapping anywhere outside a field dismisses the keyboard. */}
        <Pressable onPress={Keyboard.dismiss} accessible={false} style={styles.fill}>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.content}>
              <LoginScreen />
            </View>
          </SafeAreaView>
        </Pressable>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  safeArea: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.four },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.three },
});
