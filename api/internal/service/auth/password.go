package auth

import (
	"fmt"

	"golang.org/x/crypto/bcrypt"
)

const (
	bcryptCost      = 10
	maxPasswordLen  = 72
)

func HashPassword(password string) (string, error) {
	if len(password) > maxPasswordLen {
		return "", fmt.Errorf("password exceeds maximum length of %d bytes", maxPasswordLen)
	}
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	return string(bytes), err
}

func CheckPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}
